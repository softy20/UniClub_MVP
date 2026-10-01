/**
 * 🧭 UniClub - ManualImportWizard (운영 매뉴얼로 일정 만들기 마법사)
 *
 * 동아리 운영 매뉴얼(글이나 파일)을 올리면, AI가 부서 구성과 행사 일정을 뽑아내도록 안내해 주는 여러 단계짜리 화면입니다. 
 * 파일 업로드 → 질문에 답하기 → 부서/분류 확정 → 일정 추출 → 미리보기 순서로 진행됩니다.
 *
 * 📌 주요 기능:
 * - 매뉴얼 텍스트를 직접 입력하거나 파일(DOCX, PDF, TXT, MD)을 올릴 수 있습니다.
 * - 서버에 매뉴얼을 보내서 부서(역할) 초안과 확인 질문을 받아옵니다.
 * - 사용자가 질문에 답하면 그 답을 서버에 보내 부서표를 점점 더 정확하게 다듬습니다.
 * - 부서와 행사 분류가 확정되면, 그 기준으로 실제 행사 일정을 여러 구간(계절)으로 나눠 추출합니다.
 * - 일정 추출이 오래 걸리거나 시간 초과가 나면, 구간을 반으로 쪼개서 다시 시도합니다.
 * - 추출이 끝나면 ManualPreview 화면으로 넘어가서 결과를 미리 보고 수정할 수 있습니다.
 * - 부서/분류를 화면에서 직접 추가, 이름 변경, 삭제할 수 있습니다.
 * - 샘플 데이터로 미리보기 화면을 바로 열어볼 수도 있습니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * import { ManualImportWizard } from "./components/ManualImportWizard";
 * <ManualImportWizard existingData={null} onApply={(clubData) => saveToCalendar(clubData)} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): existingData(지금 시즌에 이미 저장된 데이터, 없으면
 *   null), onApply(완성된 일정 데이터를 달력에 적용할 때 실행할 함수)
 * - 컴포넌트 안에서 바뀌는 데이터(State): 현재 단계(phase), 입력한 텍스트/파일,
 *   동아리 이름과 연도, 부서/행사 분류 초안, 질문 목록과 답변, 확정된 부서표(profile),
 *   추출된 일정(firstEvents/secondEvents), 진행률 표시용 값들, 로딩/에러 상태 등
 * - 하위 컴포넌트/유틸: ./manual-import/ 폴더로 분리됨(FileDropzone, AddRow, ChipRenameInput,
 *   ParseProgressBar, ClarifyingBusyBanner, ExtractedPanels, constants, types, utils,
 *   useEventExtraction 훅 = 일정 추출/재시도/진행률, DepthSelectPhase/InputPhase/
 *   ClarifyingPhase/LockedPhase = 단계별 화면)
 * - 의존성: ../lib/manual-file(파일 읽기/분류), ../lib/manual-months(월 구간 확인),
 *   ../lib/parse-events(일정 합치기), ../lib/kst(오늘 날짜), ../lib/types(여러 데이터 타입),
 *   ./ManualPreview, ./marks
 *
 * 💡 팁 및 주의사항:
 * - 서버와 통신하는 부분이 많아서(fetch로 여러 Netlify 함수 호출), 네트워크 오류나 시간 초과
 *   처리가 곳곳에 들어 있습니다. 코드를 고칠 때는 오류 처리 흐름을 함께 확인하세요.
 * - 매뉴얼 텍스트가 짧고 월별 구분이 없으면 한 번에, 길면 절반씩 나눠서 일정을 추출합니다.
 * - 진행률 막대(progress bar)는 실제 진행 상황을 흉내 내는 애니메이션이 섞여 있어 정확한 퍼센트가
 *   아닐 수 있습니다.
 * - existingData가 있으면(같은 시즌에 이미 저장된 데이터가 있으면), 파싱이 끝나고 미리보기로
 *   넘어가기 직전에 withSeasonMerge로 한 번 걸러서 기존 행사를 절대 잃지 않게 합니다. 자세한
 *   병합 규칙은 ../lib/parse-events의 mergeSeasonEvents 주석 참고.
 *
 * @file ManualImportWizard.tsx
 * @module components/ManualImportWizard
 */
import { useRef, useState } from "react";
import clubSample from "../data/club.json";
import {
  classifyManualFile,
  filePayloadForApi,
  HWP_MESSAGE,
  readManualFile,
  type ManualFilePayload,
} from "../lib/manual-file";
import {
  type CategoryDefinition,
  type ClarifyingQuestion,
  type ClubData,
  type ClubGenre,
  type ClubProfile,
  type ManualImportDepth,
  type OnboardingChatMessage,
  type QuestionOption,
  type RoleDefinition,
} from "../lib/types";
import {
  FALLBACK_CATEGORY,
  FALLBACK_ROLE,
  MAX_TURNS,
} from "./manual-import/constants";
import type { AnswerOk, Phase, StartOk } from "./manual-import/types";
import {
  composeAnswerFrom,
  extraAliases,
  isCategoryQuestion,
  isDeptQuestion,
  isOtherOption,
  postJson,
  questionKey,
} from "./manual-import/utils";
import { useEventExtraction } from "./manual-import/useEventExtraction";
import { ClarifyingPhase } from "./manual-import/ClarifyingPhase";
import { DepthSelectPhase } from "./manual-import/DepthSelectPhase";
import { InputPhase } from "./manual-import/InputPhase";
import { LockedPhase } from "./manual-import/LockedPhase";
import { ManualPreview } from "./ManualPreview";

type ManualImportWizardProps = {
  existingData: ClubData | null;
  onApply: (data: ClubData) => void;
};

/**
 * 운영 매뉴얼로부터 부서표와 행사 일정을 뽑아내는 마법사 컴포넌트(입력 → 확인 질문 → 부서/분류
 * 확정 → 일정 추출 → 미리보기).
 * @param existingData - 같은 시즌에 이미 저장된 일정 데이터(없으면 null). 있으면 새로 파싱한
 * 결과를 미리보기로 넘기기 직전에 기존 일정과 병합한다(withSeasonMerge).
 * @param onApply - 미리보기(ManualPreview)에서 사용자가 최종 확정했을 때, 완성된 ClubData를
 * 전달받아 달력에 반영하는 콜백
 * 특이사항: 파일 상단 요약 주석에 단계별 상태(phase)와 하위 컴포넌트 목록이 정리되어 있다.
 * 이 함수 안의 헬퍼들은 대부분 phase별 흐름(질문 답변 전송, 부서/분류 편집, 일정 파싱 진행률
 * 관리)을 담당하며, 각 헬퍼 위에 개별 주석을 달아 두었다.
 */
export function ManualImportWizard({ existingData, onApply }: ManualImportWizardProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [depth, setDepth] = useState<ManualImportDepth | null>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [filePayload, setFilePayload] = useState<ManualFilePayload | null>(null);
  const [fileError, setFileError] = useState("");
  const [clubName, setClubName] = useState("");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [draftRoles, setDraftRoles] = useState<RoleDefinition[]>([]);
  const [draftCategories, setDraftCategories] = useState<CategoryDefinition[]>([]);
  const [categoriesAsked, setCategoriesAsked] = useState(false);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [messages, setMessages] = useState<OnboardingChatMessage[]>([]);
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({});
  const [otherByQuestion, setOtherByQuestion] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const otherInputRef = useRef<HTMLTextAreaElement>(null);
  const otherByQuestionRef = useRef<Record<string, string>>({});
  const otherKeyRef = useRef("freeform");
  otherByQuestionRef.current = otherByQuestion;
  const [turn, setTurn] = useState(1);
  const [profile, setProfile] = useState<ClubProfile | null>(null);
  const [parsed, setParsed] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [genre, setGenre] = useState<ClubGenre>("other");
  const [newRoleName, setNewRoleName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingRoleText, setEditingRoleText] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryText, setEditingCategoryText] = useState("");
  const {
    firstEvents,
    secondEvents,
    failedHalves,
    parseStep,
    parseFill,
    parseWithProfile,
    clearEvents,
    resetExtraction,
  } = useEventExtraction({
    text,
    filePayload,
    profile,
    genre,
    depth,
    existingData,
    animating: loading && phase === "locked",
    setLoading,
    setError,
    onComplete: (data) => {
      setParsed(data);
      setPhase("parsed");
    },
  });

  /**
   * 마법사 전체 상태를 처음(input 단계)으로 되돌린다.
   * 특이사항: "처음부터" 버튼과 새 파일 업로드 실패 등에서 호출되며, 텍스트/파일/질문/부서표/
   * 추출된 일정/진행률/에러 등 이 컴포넌트가 들고 있는 거의 모든 state를 초기값으로 리셋한다.
   */
  function reset() {
    setPhase("input");
    setDepth(null);
    setText("");
    setFileName("");
    setFilePayload(null);
    setFileError("");
    setClubName("");
    setAcademicYear(new Date().getFullYear());
    setDraftRoles([]);
    setDraftCategories([]);
    setCategoriesAsked(false);
    setQuestions([]);
    setMessages([]);
    setSelectedByQuestion({});
    setOtherByQuestion({});
    setQuestionIndex(0);
    setTurn(1);
    setProfile(null);
    setParsed(null);
    resetExtraction();
    setLoading(false);
    setError("");
    setGenre("other");
    setNewRoleName("");
    setNewCategoryName("");
    setEditingRole(null);
    setEditingRoleText("");
    setEditingCategory(null);
    setEditingCategoryText("");
  }

  /**
   * 부서/분류 정보(profile)를 갱신하면서, 그 기준으로 이미 뽑아 뒀던 일정 추출 결과를
   * 함께 무효화한다.
   * 특이사항: 부서나 분류가 바뀌면 이전에 추출한 일정(firstEvents/secondEvents/parsed)은
   * 더 이상 정확하지 않으므로 반드시 초기화해야 한다 — 이 함수를 거치지 않고 setProfile을
   * 직접 호출하면 안 된다.
   */
  function patchProfile(next: ClubProfile) {
    setProfile(next);
    clearEvents();
    setParsed(null);
  }

  /** 입력창에 적힌 이름으로 새 부서를 profile.roles에 추가한다(빈 값/중복 이름은 무시). */
  function addRole() {
    if (!profile) return;
    const name = newRoleName.trim();
    if (!name || profile.roles.some((role) => role.role_name === name)) return;
    patchProfile({
      ...profile,
      roles: [...profile.roles, { role_name: name, aliases: [] }],
    });
    setNewRoleName("");
  }

  /**
   * 부서 하나를 목록에서 삭제한다.
   * 특이사항: 삭제 후 부서가 하나도 안 남으면 FALLBACK_ROLE("공통")로 대체하고, 삭제된 부서가
   * default_role이었으면 남은 부서 중 첫 번째로 default_role을 다시 지정한다.
   */
  function removeRole(name: string) {
    if (!profile) return;
    const roles = profile.roles.filter((role) => role.role_name !== name);
    const nextRoles = roles.length > 0 ? roles : [FALLBACK_ROLE];
    patchProfile({
      ...profile,
      roles: nextRoles,
      default_role: nextRoles.some((role) => role.role_name === profile.default_role)
        ? profile.default_role
        : nextRoles[0].role_name,
    });
    if (editingRole === name) {
      setEditingRole(null);
      setEditingRoleText("");
    }
  }

  /**
   * 편집 중이던 부서 이름 변경을 확정한다.
   * 특이사항: 새 이름이 비어 있거나, 기존과 같거나, 이미 존재하는 이름이면 아무 변경 없이
   * 편집 모드만 종료한다. default_role이 이름이 바뀐 부서였다면 default_role도 함께 갱신한다.
   */
  function commitRoleRename() {
    if (!profile || editingRole === null) return;
    const nextName = editingRoleText.trim();
    const from = editingRole;
    setEditingRole(null);
    setEditingRoleText("");
    if (!nextName || nextName === from || profile.roles.some((role) => role.role_name === nextName)) return;
    patchProfile({
      ...profile,
      roles: profile.roles.map((role) => (role.role_name === from ? { ...role, role_name: nextName } : role)),
      default_role: profile.default_role === from ? nextName : profile.default_role,
    });
  }

  /** 입력창에 적힌 라벨로 새 행사 분류를 profile.categories에 추가한다(빈 값/중복 라벨은 무시). */
  function addCategory() {
    if (!profile) return;
    const label = newCategoryName.trim();
    if (!label || profile.categories.some((item) => item.label === label)) return;
    patchProfile({
      ...profile,
      categories: [...profile.categories, { label, aliases: [] }],
    });
    setNewCategoryName("");
  }

  /**
   * 행사 분류 하나를 목록에서 삭제한다.
   * 특이사항: 삭제 후 분류가 하나도 안 남으면 FALLBACK_CATEGORY("기타")로 대체하고, 삭제된
   * 분류가 default_category였으면 남은 분류 중 첫 번째로 다시 지정한다.
   */
  function removeCategory(label: string) {
    if (!profile) return;
    const categories = profile.categories.filter((item) => item.label !== label);
    const nextCategories = categories.length > 0 ? categories : [FALLBACK_CATEGORY];
    patchProfile({
      ...profile,
      categories: nextCategories,
      default_category: nextCategories.some((item) => item.label === profile.default_category)
        ? profile.default_category
        : nextCategories[0].label,
    });
    if (editingCategory === label) {
      setEditingCategory(null);
      setEditingCategoryText("");
    }
  }

  /**
   * 편집 중이던 행사 분류 라벨 변경을 확정한다.
   * 특이사항: 새 라벨이 비어 있거나, 기존과 같거나, 이미 존재하는 라벨이면 변경 없이 편집
   * 모드만 종료한다. default_category가 바뀐 분류였다면 함께 갱신한다.
   */
  function commitCategoryRename() {
    if (!profile || editingCategory === null) return;
    const nextLabel = editingCategoryText.trim();
    const from = editingCategory;
    setEditingCategory(null);
    setEditingCategoryText("");
    if (!nextLabel || nextLabel === from || profile.categories.some((item) => item.label === nextLabel)) return;
    patchProfile({
      ...profile,
      categories: profile.categories.map((item) => (item.label === from ? { ...item, label: nextLabel } : item)),
      default_category: profile.default_category === from ? nextLabel : profile.default_category,
    });
  }

  /**
   * 사용자가 고른(또는 드래그한) 매뉴얼 파일을 읽어서 텍스트/첨부 형태로 상태에 반영한다.
   * 특이사항: HWP 파일은 지원하지 않으므로 즉시 안내 메시지(HWP_MESSAGE)를 alert로 띄우고
   * 중단한다. 읽기에 성공하면 텍스트로 변환 가능한 파일은 미리보기 텍스트를 채우고, 그렇지
   * 않은 파일(예: PDF)은 filePayload에 담아 서버 전송 시 첨부로 보낸다.
   */
  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileError("");
    setError("");
    if (classifyManualFile(file) === "hwp") {
      setFileName("");
      setFilePayload(null);
      setFileError(HWP_MESSAGE);
      window.alert(HWP_MESSAGE);
      return;
    }
    try {
      const result = await readManualFile(file);
      setFileName(file.name);
      setFilePayload(result.payload.kind === "text" ? null : result.payload);
      if (result.previewText) setText(result.previewText);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setFileName("");
      setFilePayload(null);
      setFileError(message);
    }
  }

  /**
   * 입력된 매뉴얼 텍스트/파일을 서버(start-onboarding)로 보내 부서 초안과 첫 확인 질문들을 받아온다.
   * 특이사항: 텍스트와 파일이 모두 없으면 에러만 표시하고 요청하지 않는다. 성공하면 phase를
   * "clarifying"으로 전환하고, PDF가 아닌 첨부는 서버가 텍스트로 돌려준 값(result.text)으로
   * 대체되었다고 보고 filePayload를 비운다(중복 전송 방지).
   */
  async function startOnboarding() {
    const manual = text.trim();
    const file = filePayloadForApi(filePayload);
    if (!manual && !file) {
      setError("매뉴얼 텍스트를 입력하거나 파일을 업로드하세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await postJson<StartOk>("/.netlify/functions/start-onboarding", {
        text: manual,
        file,
        depth,
      });
      if (result.text) setText(result.text);
      if (filePayload?.kind !== "pdf") setFilePayload(null);
      const assistant = result.assistant_message || result.questions.map((item) => item.question).join("\n");
      setClubName(result.club_name);
      setAcademicYear(result.academic_year);
      setDraftRoles(result.draft_roles);
      setDraftCategories(result.draft_categories ?? []);
      setCategoriesAsked((result.questions ?? []).some((question) => question.category === "event_categories"));
      setQuestions(result.questions);
      setSelectedByQuestion({});
      setOtherByQuestion({});
      setQuestionIndex(0);
      setMessages([{ role: "assistant", content: assistant }]);
      setTurn(1);
      setPhase("clarifying");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  /**
   * 현재 "기타" 입력창(textarea, ref로 직접 제어)에 아직 state로 반영되지 않은 값을 읽어
   * otherByQuestion에 합쳐서 돌려준다.
   * 특이사항: 입력창 값은 onChange로 매번 state에 반영되지만, blur/Enter 처리 순서 때문에
   * state 갱신 전에 최신 값이 필요한 경우(전송 직전 등)를 위해 ref에서 직접 읽어 보정한다.
   */
  function readOtherDraft(): Record<string, string> {
    const next = { ...otherByQuestionRef.current };
    if (otherInputRef.current) next[otherKeyRef.current] = otherInputRef.current.value;
    otherByQuestionRef.current = next;
    return next;
  }

  function composeAnswer(selected = selectedByQuestion, others = readOtherDraft()): string | null {
    return composeAnswerFrom(questions, selected, others);
  }

  function openSamplePreview() {
    setError("");
    setParsed(clubSample as ClubData);
    setPhase("parsed");
  }

  /**
   * 현재까지 고른 답변(또는 contentOverride로 넘어온 문자열)을 서버(answer-onboarding)에 보내
   * 다음 확인 질문을 받거나 부서표를 확정한다.
   * @param contentOverride - 이미 조합된 답변 문자열이 있으면 그대로 사용(예: chooseOption에서
   * 마지막 선택지를 고르자마자 바로 전송할 때)하고, 없으면 현재 선택/기타 입력값으로 새로 조합한다.
   * 특이사항: 서버 응답 status가 "locked"면 profile을 확정하고 phase를 "locked"로 전환하며,
   * 그렇지 않으면 다음 질문 목록으로 갱신한다. turn이 MAX_TURNS에 도달하면 경고 메시지를 띄운다.
   */
  async function sendAnswer(contentOverride?: string) {
    const others = readOtherDraft();
    setOtherByQuestion(others);
    const content = (contentOverride ?? composeAnswer(selectedByQuestion, others) ?? "").trim();
    if (!content) {
      setError("선택지를 고르거나, 기타를 고른 뒤 내용을 입력하세요.");
      return;
    }
    const nextTurn = turn + 1;
    const nextMessages: OnboardingChatMessage[] = [...messages, { role: "user", content }];
    setLoading(true);
    setError("");
    try {
      const result = await postJson<AnswerOk>("/.netlify/functions/answer-onboarding", {
        text,
        file: filePayloadForApi(filePayload),
        club_name: clubName,
        academic_year: academicYear,
        draft_roles: draftRoles,
        draft_categories: draftCategories,
        categories_asked: categoriesAsked || questions.some((question) => question.category === "event_categories"),
        messages: nextMessages,
        turn: nextTurn,
        depth,
      });
      const assistant = result.assistant_message;
      setMessages([...nextMessages, { role: "assistant", content: assistant }]);
      setSelectedByQuestion({});
      setOtherByQuestion({});
      setQuestionIndex(0);
      setTurn(result.turn);
      if (result.status === "locked") {
        setProfile(result.profile);
        setPhase("locked");
        return;
      }
      setDraftRoles(result.draft_roles);
      setDraftCategories(result.draft_categories ?? []);
      if ((result.questions ?? []).some((question) => question.category === "event_categories")) {
        setCategoriesAsked(true);
      }
      setQuestions(result.questions);
      if (result.turn >= MAX_TURNS) {
        setError("질문 한도에 도달했습니다. 한 번 더 답하면 부서표가 확정됩니다.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }


  const questionCount = Math.max(questions.length, 1);
  const safeQuestionIndex = Math.min(questionIndex, questionCount - 1);
  const currentQuestion = questions[safeQuestionIndex];
  const currentKey = currentQuestion ? questionKey(currentQuestion, safeQuestionIndex) : "freeform";
  otherKeyRef.current = currentKey;
  const selectedId = currentQuestion
    ? (selectedByQuestion[currentKey] ?? selectedByQuestion[currentQuestion.question])
    : undefined;
  const selectedOption = currentQuestion?.options.find((item) => item.id === selectedId);
  const showOther = selectedOption ? isOtherOption(selectedOption) : false;
  const roleRoster = (profile?.roles ?? draftRoles).map((role) => role.role_name);
  const showExtractedRoles = isDeptQuestion(currentQuestion) && draftRoles.length > 0;
  const showExtractedCategories = isCategoryQuestion(currentQuestion) && draftCategories.length > 0;
  const showAliasHint = showExtractedRoles && draftRoles.some((role) => extraAliases(role).length > 0);
  const clarifyingBusyLabel = turn + 1 >= MAX_TURNS ? "부서표 확정 중" : "답변 전송 중";
  const otherDraftValue = currentQuestion
    ? (otherByQuestion[currentKey] ?? otherByQuestion[currentQuestion.question] ?? "")
    : (otherByQuestion.freeform ?? "");

  /** "기타" 선택지의 직접 입력값을 현재 질문 키로 저장한다(ref도 같이 갱신해 전송 시 최신값을 읽는다). */
  function changeOther(value: string) {
    setOtherByQuestion((prev) => {
      const next = { ...prev, [currentKey]: value };
      otherByQuestionRef.current = next;
      return next;
    });
  }

  /** 질문이 없는 자유 입력 모드의 입력값을 저장한다(키는 항상 "freeform" 하나뿐). */
  function changeFreeform(value: string) {
    const next = { freeform: value };
    otherByQuestionRef.current = next;
    setOtherByQuestion(next);
  }

  /**
   * 확인 질문의 선택지를 고른다.
   * 특이사항: "기타" 선택지가 아니고 마지막 질문이 아니면, 살짝(320ms) 지연 후 자동으로 다음
   * 질문으로 넘어간다(선택 애니메이션을 보여줄 시간을 준다). 마지막 질문에서 고르면 바로 답변을
   * 조합해서 전송한다.
   */
  function chooseOption(question: ClarifyingQuestion, option: QuestionOption) {
    const index = questions.indexOf(question);
    const key = questionKey(question, index === -1 ? safeQuestionIndex : index);
    const next = { ...selectedByQuestion, [key]: option.id };
    setSelectedByQuestion(next);
    setError("");
    if (isOtherOption(option)) return;
    const isLast = questions.length <= 1 || safeQuestionIndex >= questions.length - 1;
    if (!isLast) {
      window.setTimeout(() => setQuestionIndex((value) => Math.min(value + 1, questions.length - 1)), 320);
      return;
    }
    const content = composeAnswerFrom(questions, next, readOtherDraft());
    if (content) void sendAnswer(content);
  }

  /**
   * "확인" 버튼(또는 기타 입력 후 확정)을 눌렀을 때의 처리.
   * 특이사항: 질문이 아예 없는 자유 입력 모드, 선택지를 안 고른 경우, "기타"인데 직접 입력이
   * 비어 있는 경우를 각각 검증해서 에러 메시지를 띄운다. 검증을 통과하면 마지막 질문이 아닐 때는
   * 다음 질문으로 넘어가고, 마지막 질문이면 답변을 조합해 서버로 전송한다.
   */
  function confirmCurrentQuestion() {
    const others = readOtherDraft();
    setOtherByQuestion(others);
    if (!currentQuestion) {
      const content = (others.freeform ?? "").trim();
      if (!content) {
        setError("선택지를 고르거나, 기타를 고른 뒤 내용을 입력하세요.");
        return;
      }
      void sendAnswer(content);
      return;
    }
    const key = questionKey(currentQuestion, safeQuestionIndex);
    const selected = selectedByQuestion[key] ?? selectedByQuestion[currentQuestion.question];
    const option = currentQuestion.options.find((item) => item.id === selected);
    if (!option) {
      setError("선택지를 고르거나, 기타를 고른 뒤 내용을 입력하세요.");
      return;
    }
    if (isOtherOption(option) && !(others[key] ?? others[currentQuestion.question] ?? "").trim()) {
      setError("선택지를 고르거나, 기타를 고른 뒤 내용을 입력하세요.");
      return;
    }
    const isLast = questions.length <= 1 || safeQuestionIndex >= questions.length - 1;
    if (!isLast) {
      setError("");
      setQuestionIndex((value) => Math.min(value + 1, questions.length - 1));
      return;
    }
    const content = composeAnswerFrom(questions, selectedByQuestion, others);
    if (!content) {
      setError("선택지를 고르거나, 기타를 고른 뒤 내용을 입력하세요.");
      return;
    }
    void sendAnswer(content);
  }

  if (phase === "parsed" && parsed) {
    return (
      <div className="h-full overflow-y-auto">
        <ManualPreview
          data={parsed}
          categoryOptions={profile?.categories.map((item) => item.label)}
          onChange={setParsed}
          onApply={onApply}
          onBack={profile ? () => setPhase("locked") : undefined}
          onReset={reset}
        />
      </div>
    );
  }

  return (
    <div className="fade-in h-full overflow-y-auto p-4 md:p-6">
      <div
        className={`mx-auto flex w-full flex-col gap-4 ${
          phase === "input" && depth === null ? "max-w-[740px]" : "max-w-[620px]"
        }`}
      >
        {phase === "input" && depth === null ? <DepthSelectPhase onSelect={setDepth} /> : null}

        {phase === "input" && depth !== null ? (
          <InputPhase
            depth={depth}
            text={text}
            fileName={fileName}
            filePayload={filePayload}
            fileError={fileError}
            error={error}
            loading={loading}
            onTextChange={setText}
            onFile={(file) => void onFile(file)}
            onChangeDepth={() => setDepth(null)}
            onStart={() => void startOnboarding()}
            onOpenSample={openSamplePreview}
          />
        ) : null}

        {phase === "clarifying" ? (
          <ClarifyingPhase
            loading={loading}
            error={error}
            busyLabel={clarifyingBusyLabel}
            turn={turn}
            questionCount={questionCount}
            questionIndex={safeQuestionIndex}
            currentQuestion={currentQuestion}
            currentKey={currentKey}
            selectedId={selectedId}
            showOther={showOther}
            showExtractedRoles={showExtractedRoles}
            showExtractedCategories={showExtractedCategories}
            showAliasHint={showAliasHint}
            draftRoles={draftRoles}
            draftCategories={draftCategories}
            otherDraftValue={otherDraftValue}
            otherInputRef={otherInputRef}
            onChooseOption={chooseOption}
            onOtherChange={changeOther}
            onFreeformChange={changeFreeform}
            onPrev={() => setQuestionIndex((index) => Math.max(0, index - 1))}
            onConfirm={confirmCurrentQuestion}
            onReset={reset}
          />
        ) : null}

        {phase === "locked" && profile ? (
          <LockedPhase
            profile={profile}
            roleRoster={roleRoster}
            loading={loading}
            error={error}
            genre={genre}
            onGenreChange={setGenre}
            editingRole={editingRole}
            editingRoleText={editingRoleText}
            newRoleName={newRoleName}
            onEditingRoleTextChange={setEditingRoleText}
            onStartRoleRename={(name) => {
              setEditingRole(name);
              setEditingRoleText(name);
            }}
            onCommitRoleRename={commitRoleRename}
            onCancelRoleRename={() => {
              setEditingRole(null);
              setEditingRoleText("");
            }}
            onRemoveRole={removeRole}
            onNewRoleNameChange={setNewRoleName}
            onAddRole={addRole}
            editingCategory={editingCategory}
            editingCategoryText={editingCategoryText}
            newCategoryName={newCategoryName}
            onEditingCategoryTextChange={setEditingCategoryText}
            onStartCategoryRename={(label) => {
              setEditingCategory(label);
              setEditingCategoryText(label);
            }}
            onCommitCategoryRename={commitCategoryRename}
            onCancelCategoryRename={() => {
              setEditingCategory(null);
              setEditingCategoryText("");
            }}
            onRemoveCategory={removeCategory}
            onNewCategoryNameChange={setNewCategoryName}
            onAddCategory={addCategory}
            firstEvents={firstEvents}
            secondEvents={secondEvents}
            failedHalves={failedHalves}
            parseStep={parseStep}
            parseFill={parseFill}
            onParse={(halves) => void parseWithProfile(halves)}
            onReset={reset}
          />
        ) : null}
      </div>
    </div>
  );
}
