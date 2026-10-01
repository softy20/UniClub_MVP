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
 *   ParseProgressBar, ClarifyingBusyBanner, ExtractedPanels, constants, types, utils)
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
import { Lightbulb } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import clubSample from "../data/club.json";
import { readKst } from "../lib/kst";
import {
  classifyManualFile,
  filePayloadForApi,
  HWP_MESSAGE,
  MANUAL_TEXT_PLACEHOLDER,
  MANUAL_UPLOAD_GUIDE,
  MANUAL_UPLOAD_INTRO,
  readManualFile,
  type ManualFilePayload,
} from "../lib/manual-file";
import { hasMonthSections } from "../lib/manual-months";
import { mergeClubEvents, mergeSeasonEvents } from "../lib/parse-events";
import {
  CLUB_GENRES,
  MANUAL_IMPORT_DEPTHS,
  manualImportDepthLabel,
  type CategoryDefinition,
  type ClarifyingQuestion,
  type ClubData,
  type ClubEvent,
  type ClubGenre,
  type ClubProfile,
  type ManualImportDepth,
  type OnboardingChatMessage,
  type QuestionOption,
  type RoleDefinition,
} from "../lib/types";
import { AddRow } from "./manual-import/AddRow";
import { ChipRenameInput } from "./manual-import/ChipRenameInput";
import { ClarifyingBusyBanner } from "./manual-import/ClarifyingBusyBanner";
import {
  CATEGORY_LABEL,
  FALLBACK_CATEGORY,
  FALLBACK_ROLE,
  MAX_TURNS,
  PARSE_CHUNK_MS,
  PARSE_CHUNK_TOTAL,
  PARSE_FINISH_MS,
  PARSE_HALVES,
  SHORT_MANUAL_CHARS,
} from "./manual-import/constants";
import { ExtractedCategoriesPanel, ExtractedRolesPanel } from "./manual-import/ExtractedPanels";
import { FileDropzone } from "./manual-import/FileDropzone";
import { ParseProgressBar } from "./manual-import/ParseProgressBar";
import type { AnswerOk, ParseHalf, ParseOk, Phase, StartOk } from "./manual-import/types";
import {
  clubDataFromProfile,
  composeAnswerFrom,
  extraAliases,
  formatParseStep,
  isCategoryQuestion,
  isDeptQuestion,
  isOtherOption,
  isTimeoutError,
  postJson,
  questionKey,
  settledChunkCount,
  waitForPaint,
  waitMs,
} from "./manual-import/utils";
import { ManualPreview } from "./ManualPreview";
import { RoleChip, Tag } from "./marks";

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
  const [firstEvents, setFirstEvents] = useState<ClubEvent[] | null>(null);
  const [secondEvents, setSecondEvents] = useState<ClubEvent[] | null>(null);
  const [failedHalves, setFailedHalves] = useState<ParseHalf[]>([]);
  const [parseStep, setParseStep] = useState("");
  const [parseCompleted, setParseCompleted] = useState(0);
  const [parseFill, setParseFill] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [genre, setGenre] = useState<ClubGenre>("other");
  const [newRoleName, setNewRoleName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingRoleText, setEditingRoleText] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryText, setEditingCategoryText] = useState("");
  const parseFinishingRef = useRef(false);

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
    setFirstEvents(null);
    setSecondEvents(null);
    setFailedHalves([]);
    setParseStep("");
    setParseCompleted(0);
    setParseFill(0);
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
    setFirstEvents(null);
    setSecondEvents(null);
    setFailedHalves([]);
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

  /**
   * 확정된 부서표(profile) 기준으로 서버(parse-manual-with-profile)에 일정 추출을 요청한다.
   * @param months - 특정 월들만 추출할 때 지정(예: [3,4,5]). 생략하면 매뉴얼 전체를 한 번에 추출한다.
   */
  async function requestEvents(months?: number[]): Promise<ClubEvent[]> {
    if (!profile) throw new Error("부서표가 없습니다.");
    const result = await postJson<ParseOk>("/.netlify/functions/parse-manual-with-profile", {
      text,
      file: filePayloadForApi(filePayload),
      profile,
      ...(months && months.length > 0 ? { months } : {}),
      genre,
      depth,
    });
    return result.data.events;
  }

  /**
   * 지정된 월 구간의 일정을 추출하되, 서버가 시간 초과로 실패하면 구간을 절반으로 쪼개서
   * 재귀적으로 다시 시도한다.
   * 특이사항: 시간 초과가 아닌 다른 에러이거나 더 이상 쪼갤 수 없는 단일 월(months.length<=1)이면
   * 그대로 에러를 던진다. 진행 상황 표시를 위해 요청 전에 setParseStep으로 현재 구간 라벨을
   * 갱신한다.
   */
  async function requestEventsResilient(months: number[]): Promise<ClubEvent[]> {
    setParseStep(formatParseStep(months));
    try {
      return await requestEvents(months);
    } catch (error) {
      if (!isTimeoutError(error) || months.length <= 1) throw error;
      const mid = Math.ceil(months.length / 2);
      const left = await requestEventsResilient(months.slice(0, mid));
      const right = await requestEventsResilient(months.slice(mid));
      return mergeClubEvents(left, right);
    }
  }

  // 지금 시즌에 이미 저장된 데이터가 있으면, 새로 파싱한 결과를 그 위에 안전하게 얹는다
  // (기존 행사는 절대 안 바꾸고, 새 행사·새 할 일만 추가 — mergeSeasonEvents 참고).
  /**
   * 새로 파싱한 ClubData(fresh)를 기존 시즌 데이터(existingData)와 병합한다.
   * @returns existingData가 없으면 fresh를 그대로, 있으면 academic_year를 기존 값으로 맞추고
   * 이벤트를 mergeSeasonEvents로 병합한 결과
   */
  function withSeasonMerge(fresh: ClubData): ClubData {
    if (!existingData) return fresh;
    const year = existingData.club_info.academic_year;
    return {
      ...fresh,
      club_info: { ...fresh.club_info, academic_year: year },
      events: mergeSeasonEvents(existingData.events, fresh.events, year, readKst().civil),
    };
  }

  /**
   * 일정 추출이 끝났을 때, 진행률을 100%로 채우고 화면에 반영될 때까지 잠깐 기다린 뒤
   * 미리보기 화면(phase="parsed")으로 전환한다.
   * 특이사항: parseFinishingRef를 true로 표시해서, 진행률 애니메이션 useEffect가 더 이상
   * 진행률을 임의로 계산하지 않고 100%로 고정되게 한다.
   */
  async function finishParsePreview(data: ClubData) {
    parseFinishingRef.current = true;
    setParseCompleted(PARSE_CHUNK_TOTAL);
    setParseFill(100);
    await waitForPaint();
    await waitMs(PARSE_FINISH_MS);
    setParsed(data);
    setPhase("parsed");
  }

  /**
   * 확정된 부서표를 기준으로 실제 행사 일정을 추출하는 메인 파이프라인.
   * @param halves - 재시도할 반기만 지정(예: 실패한 "first"만 다시). 생략하면 아직 완료되지
   * 않은 반기들을 자동으로 골라 진행한다.
   * 특이사항:
   * - 매뉴얼이 짧고(SHORT_MANUAL_CHARS 미만) 월별 구분이 없으면, 반기로 나누지 않고 한 번에
   *   ("연간 일정") 추출한다.
   * - 그 외에는 상반기/하반기(PARSE_HALVES)를 계절 단위 구간으로 나눠 순서대로 요청하고
   *   (requestEventsResilient가 시간 초과 시 알아서 더 잘게 쪼갠다), 구간이 끝날 때마다
   *   진행률(parseCompleted/parseFill)을 갱신한다.
   * - 한쪽 반기가 실패해도 다른 반기는 계속 진행하며, 실패한 반기는 failedHalves에 남겨서
   *   화면에서 개별적으로 "다시 파싱"할 수 있게 한다.
   * - 양쪽 반기가 모두 성공하면 두 결과를 합쳐 finishParsePreview로 미리보기 화면으로 넘어간다.
   */
  async function parseWithProfile(halves?: ParseHalf[]) {
    if (!profile) return;

    setLoading(true);
    setError("");
    parseFinishingRef.current = false;

    if (!halves && text.trim().length > 0 && text.trim().length < SHORT_MANUAL_CHARS && !hasMonthSections(text)) {
      setParseCompleted(0);
      setParseFill(8);
      setParseStep("연간 일정");
      try {
        const events = await requestEvents();
        await finishParsePreview(withSeasonMerge(clubDataFromProfile(profile, mergeClubEvents(events), genre)));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setParseStep("");
        setLoading(false);
      }
      return;
    }

    const toRun =
      halves ??
      (["first", "second"] as ParseHalf[]).filter((half) =>
        half === "first" ? firstEvents === null : secondEvents === null,
      );
    const targets = toRun.length > 0 ? toRun : (["first", "second"] as ParseHalf[]);

    const nextFailed = new Set(failedHalves);
    let nextFirst = firstEvents;
    let nextSecond = secondEvents;
    let lastError = "";
    let completed =
      settledChunkCount("first", firstEvents, targets) + settledChunkCount("second", secondEvents, targets);
    setParseCompleted(completed);
    setParseFill(completed === 0 ? 6 : (completed / PARSE_CHUNK_TOTAL) * 100);
    const firstChunk = PARSE_HALVES[targets[0]]?.chunks[0];
    if (firstChunk) setParseStep(formatParseStep(firstChunk));

    try {
      for (const half of targets) {
        const chunks = PARSE_HALVES[half].chunks;
        const halfBase = completed;
        try {
          const collected: ClubEvent[] = [];
          for (const chunk of chunks) {
            collected.push(...(await requestEventsResilient(chunk)));
            completed += 1;
            setParseCompleted(completed);
            setParseFill((fill) => Math.max(fill, (completed / PARSE_CHUNK_TOTAL) * 100));
          }
          const events = mergeClubEvents(collected);
          if (half === "first") nextFirst = events;
          else nextSecond = events;
          nextFailed.delete(half);
          setFirstEvents(nextFirst);
          setSecondEvents(nextSecond);
          setFailedHalves([...nextFailed]);
        } catch (cause) {
          nextFailed.add(half);
          lastError = cause instanceof Error ? cause.message : String(cause);
          setFailedHalves([...nextFailed]);
          completed = halfBase + chunks.length;
          setParseCompleted(completed);
          setParseFill((fill) => Math.max(fill, (completed / PARSE_CHUNK_TOTAL) * 100));
        }
      }

      if (nextFirst && nextSecond && nextFailed.size === 0) {
        await finishParsePreview(
          withSeasonMerge(clubDataFromProfile(profile, mergeClubEvents(nextFirst, nextSecond), genre)),
        );
        return;
      }
      if (lastError) setError(lastError);
    } finally {
      setParseStep("");
      setLoading(false);
    }
  }

  // 실제 진행 상황(parseCompleted, 몇 구간이 끝났는지)과는 별개로, 진행률 막대가 매끄럽게
  // 채워지는 것처럼 보이도록 100ms마다 값을 계산해서 흉내 내는 애니메이션이다. 남은 구간 수 기준
  // 예상 소요 시간(PARSE_CHUNK_MS)까지는 선형에 가깝게, 그 이후로는 지수 감쇠로 97%까지만
  // 서서히 다가가다가(실제로 다 끝나기 전에 100%처럼 보이지 않도록) finishParsePreview가
  // parseFinishingRef를 세우면 그때 100%로 마무리된다.
  useEffect(() => {
    if (!loading || phase !== "locked") return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setParseFill((current) => {
        if (parseFinishingRef.current || parseCompleted >= PARSE_CHUNK_TOTAL) return 100;
        const floor = (parseCompleted / PARSE_CHUNK_TOTAL) * 100;
        const remaining = PARSE_CHUNK_TOTAL - parseCompleted;
        const span = 100 - floor;
        const expected = remaining * PARSE_CHUNK_MS;
        const t = (Date.now() - startedAt) / expected;
        const head = 0.86;
        const tail = 0.97;
        const portion =
          t <= head ? t : head + (tail - head) * (1 - Math.exp(-(t - head) / 0.45));
        const target = floor + span * Math.min(tail, portion);
        return Math.min(97, Math.max(current, floor, 6, target));
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [loading, parseCompleted, phase]);

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
        {phase === "input" && depth === null ? (
          <>
            <p className="text-[12px] tracking-widest text-fg3 uppercase">문서 파싱 · 부서표 온보딩</p>
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <h2 className="font-display text-lg font-bold text-fg">어떤 식으로 추출해드릴까요?</h2>
              <p className="mt-1 text-sm text-fg3">
                나중에 언제든 바꿀 수 있어요. 매뉴얼이 있든 키워드 몇 줄뿐이든, 다음 단계에서 똑같이 입력할 수 있어요.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[repeat(3,minmax(0,190px))] sm:justify-evenly">
                {MANUAL_IMPORT_DEPTHS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDepth(option.id)}
                    className="my-[30px] flex aspect-square cursor-pointer flex-col items-center rounded-2xl border border-sky-100 bg-sky-50 p-5 text-center transition-colors hover:border-accent"
                  >
                    <div className="flex flex-1 flex-col items-center justify-center">
                      <p className="font-display text-[17px] font-bold text-fg">{option.title}</p>
                      <div className="mt-2 flex min-h-[44px] w-full items-center justify-center">
                        <p className="my-[10px] text-[13px] leading-relaxed whitespace-pre-line text-fg3">{option.description}</p>
                      </div>
                    </div>
                    <div className="flex min-h-[32px] w-full items-center justify-center border-t border-sky-100 pt-2">
                      <p className="text-[11px] leading-snug text-fg3">{option.recommend}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {phase === "input" && depth !== null ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12px] tracking-widest text-fg3 uppercase">문서 파싱 · 부서표 온보딩</p>
              <button
                type="button"
                onClick={() => setDepth(null)}
                className="cursor-pointer text-[12px] font-semibold text-accent"
              >
                {manualImportDepthLabel(depth)} · 변경
              </button>
            </div>
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <section className="rounded-2xl border border-border bg-card p-4">
              <div
                className="mb-3 rounded-2xl border px-4 py-3.5"
                style={{
                  background: "rgba(0,102,255,0.06)",
                  borderColor: "rgba(0,102,255,0.18)",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Lightbulb size={18} weight="fill" color="#F5C518" aria-hidden="true" />
                  <p className="text-[13px] font-semibold text-accent">파일 업로드 가이드</p>
                </div>
                <div style={{ paddingLeft: "25px" }}>
                  <p className="text-[13px] leading-relaxed text-fg2">
                    <span className="font-semibold text-fg">{MANUAL_UPLOAD_INTRO}</span> {MANUAL_UPLOAD_GUIDE} 부서·직책이 없으면 공통으로 진행할 수 있습니다.
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-fg2">
                    파일은 <span className="font-semibold text-fg">4MB 이하</span>만 올려 주세요. 사진이 들어 있으면 용량이
                    커지니, 글자만 남기면 매뉴얼이 훨씬 가벼워집니다.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["DOCX", "PDF", "TXT", "MD"].map((ext) => (
                      <span
                        key={ext}
                        className="rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent2"
                        style={{ background: "rgba(255,255,255,0.8)" }}
                      >
                        {ext}
                      </span>
                    ))}
                  </div>
                </div>
                <div>

                </div>

              </div>
              <div className="mb-3">
                <FileDropzone onFileSelect={(file) => void onFile(file)} />
                {fileName ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card2 px-3 py-2">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-[rgba(34,197,94,0.15)] text-[11px] font-bold text-[#16a34a]">
                      ✓
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-fg">{fileName}</p>
                      <p className="text-[12px] text-fg3">
                        {filePayload
                          ? "파일이 첨부되었습니다. 미리보기는 건너뛰고 추출 시 서버에서 읽습니다."
                          : "텍스트가 입력칸에 채워졌습니다. 긴 워드 매뉴얼도 여기서 바로 추출합니다."}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              {fileError ? (
                <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {fileError === HWP_MESSAGE ? HWP_MESSAGE : fileError}
                </p>
              ) : null}
              <label className="mb-2 block text-sm font-medium text-fg">매뉴얼 텍스트</label>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={10}
                className="mb-3 w-full rounded-xl border border-border bg-card2 p-3 text-sm text-fg"
                placeholder={MANUAL_TEXT_PLACEHOLDER}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => void startOnboarding()}
                className="font-display w-full cursor-pointer rounded-[10px] bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "부서 초안 추출 중..." : "부서 초안 추출"}
              </button>
              <button
                type="button"
                onClick={openSamplePreview}
                className="mt-2 w-full cursor-pointer rounded-[10px] border border-border bg-card py-2.5 text-sm font-semibold text-fg2"
              >
                샘플 데이터로 미리보기 에디터 열기
              </button>
            </section>
          </>
        ) : null}

        {phase === "clarifying" ? (
          <section className="flex min-h-[calc(100%-1rem)] flex-col justify-center py-8">
            {loading ? <ClarifyingBusyBanner label={clarifyingBusyLabel} /> : null}
            {error ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <div className="mb-10">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.08em] text-fg3 uppercase">
                  {safeQuestionIndex + 1} / {questionCount} 단계 확인 중 · 턴 {turn}/{MAX_TURNS}
                </span>
                <span className="text-xs text-fg3">{Math.round(((safeQuestionIndex + 1) / questionCount) * 100)}% 완료</span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: questionCount }, (_, index) => (
                  <div
                    key={index}
                    className="h-1 flex-1 rounded-full transition-colors duration-300"
                    style={{ background: index <= safeQuestionIndex ? "var(--accent)" : "var(--border)" }}
                  />
                ))}
              </div>
            </div>

            <div
              key={currentKey}
              className="fade-in rounded-[20px] border border-border bg-card px-5 pt-7 pb-6 md:px-10 md:pt-10 md:pb-9"
              aria-busy={loading}
            >
              <p className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
                {currentQuestion ? CATEGORY_LABEL[currentQuestion.category] : "추가 확인"} · 확인 {safeQuestionIndex + 1}단계
              </p>
              <h2 className="font-display mb-2 text-[22px] leading-snug font-bold text-fg">
                {currentQuestion?.question ?? "추가로 알려주실 내용이 있나요?"}
              </h2>
              <p className={`text-sm leading-relaxed text-fg3 ${showExtractedRoles || showExtractedCategories ? "mb-4" : "mb-7"}`}>
                {currentQuestion
                  ? showAliasHint
                    ? "매뉴얼에서 감지된 부서 별칭이 있습니다. 통합 여부를 선택하세요."
                    : showExtractedCategories
                      ? "매뉴얼에서 뽑은 짧은 분류입니다. 이후 일정 추출은 이 목록만 사용합니다."
                      : "매뉴얼에서 추출한 내용입니다. 선택지를 고르면 다음 질문으로 이동합니다."
                  : "선택지가 없으면 내용을 입력한 뒤 확인을 눌러 주세요."}
              </p>

              {showExtractedRoles ? <ExtractedRolesPanel roles={draftRoles} /> : null}
              {showExtractedCategories ? <ExtractedCategoriesPanel categories={draftCategories} /> : null}

              {currentQuestion ? (
                <div className="flex flex-col gap-2.5">
                  {currentQuestion.options.map((option) => {
                    const selected = selectedId === option.id;
                    const customOpen = selected && isOtherOption(option);
                    return (
                      <div key={option.id}>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => chooseOption(currentQuestion, option)}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-[18px] py-3.5 text-left text-sm font-medium text-fg disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                            background: selected ? "rgba(0,102,255,0.06)" : "var(--bg)",
                          }}
                        >
                          <span
                            className="flex size-[18px] shrink-0 items-center justify-center rounded-full"
                            style={{
                              border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                              background: selected ? "var(--accent)" : "transparent",
                            }}
                          >
                            {selected ? <span className="size-[7px] rounded-full bg-white" /> : null}
                          </span>
                          {isOtherOption(option) ? <span className="text-fg3">{option.label}</span> : option.label}
                        </button>
                        {customOpen ? (
                          <div className="fade-in mt-2 flex gap-2">
                            <textarea
                              ref={otherInputRef}
                              autoFocus
                              disabled={loading}
                              value={otherDraftValue}
                              onChange={(event) => {
                                const value = event.target.value;
                                setOtherByQuestion((prev) => {
                                  const next = { ...prev, [currentKey]: value };
                                  otherByQuestionRef.current = next;
                                  return next;
                                });
                              }}
                              rows={3}
                              className="w-full rounded-[10px] border-[1.5px] border-accent bg-bg p-3 text-sm text-fg outline-none disabled:opacity-60"
                              placeholder="직접 입력해 주세요..."
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  ref={otherInputRef}
                  disabled={loading}
                  value={otherDraftValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    const next = { freeform: value };
                    otherByQuestionRef.current = next;
                    setOtherByQuestion(next);
                  }}
                  rows={4}
                  className="w-full rounded-[10px] border-[1.5px] border-border bg-bg p-3 text-sm text-fg disabled:opacity-60"
                  placeholder="추가로 확정할 내용을 입력하세요."
                />
              )}

              <div className="mt-6 flex items-center gap-3">
                {safeQuestionIndex > 0 ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-fg3 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ← 이전 단계로
                  </button>
                ) : null}
                <div className="flex-1" />
                {showOther || !currentQuestion ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => confirmCurrentQuestion()}
                    className="font-display cursor-pointer rounded-[10px] bg-accent px-[18px] py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? clarifyingBusyLabel : "확인"}
                  </button>
                ) : loading ? (
                  <p className="text-[13px] font-semibold text-accent">{clarifyingBusyLabel}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={reset}
              className="mt-4 self-start text-[13px] text-fg3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              처음부터
            </button>
          </section>
        ) : null}

        {phase === "locked" && profile ? (
          <section className="flex flex-col py-8">
            {error ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[14px] bg-[rgba(0,102,255,0.1)] text-[22px]">
                🔒
              </div>
              <h2 className="font-display mb-2 text-[22px] font-extrabold text-fg md:text-[26px]">부서와 행사 분류를 확인해 주세요</h2>
              <p className="text-sm text-fg3">
                {profile.club_name} · {profile.academic_year}년. 아래 목록으로 연간 행사를 분류합니다. 추가하거나 삭제한 뒤
                다음으로 넘어가세요.
              </p>
            </div>
            <div className="mb-5 rounded-[20px] border border-border bg-card p-5 md:p-8">
              <p className="mb-4 text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">현재 팀 목록</p>
              <div className="mb-0 flex flex-wrap items-center gap-2.5">
                {profile.roles.map((role) =>
                  editingRole === role.role_name ? (
                    <ChipRenameInput
                      key={role.role_name}
                      value={editingRoleText}
                      onChange={setEditingRoleText}
                      onCommit={commitRoleRename}
                      onCancel={() => {
                        setEditingRole(null);
                        setEditingRoleText("");
                      }}
                    />
                  ) : (
                    <RoleChip
                      key={role.role_name}
                      name={role.role_name}
                      roster={roleRoster}
                      onClick={
                        loading
                          ? undefined
                          : () => {
                            setEditingRole(role.role_name);
                            setEditingRoleText(role.role_name);
                          }
                      }
                      onRemove={loading ? undefined : () => removeRole(role.role_name)}
                    />
                  ),
                )}
              </div>
              {profile.roles.length === 1 && profile.roles[0].role_name === "공통" ? (
                <p className="mt-4 text-[12px] text-fg3">역할이 없어도 공통으로 일정을 만들 수 있습니다.</p>
              ) : null}
              <AddRow
                value={newRoleName}
                placeholder="새 부서 이름 입력 후 Enter..."
                onChange={setNewRoleName}
                onAdd={addRole}
                disabled={loading}
              />
            </div>
            <div className="mb-5 rounded-[20px] border border-border bg-card p-5 md:p-8">
              <p className="mb-4 text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">행사 분류</p>
              <div className="flex flex-wrap items-center gap-2.5">
                {profile.categories.map((item) =>
                  editingCategory === item.label ? (
                    <ChipRenameInput
                      key={item.label}
                      value={editingCategoryText}
                      onChange={setEditingCategoryText}
                      onCommit={commitCategoryRename}
                      onCancel={() => {
                        setEditingCategory(null);
                        setEditingCategoryText("");
                      }}
                    />
                  ) : (
                    <Tag
                      key={item.label}
                      cat={item.label}
                      onClick={
                        loading
                          ? undefined
                          : () => {
                            setEditingCategory(item.label);
                            setEditingCategoryText(item.label);
                          }
                      }
                      onRemove={loading ? undefined : () => removeCategory(item.label)}
                    />
                  ),
                )}
              </div>
              <AddRow
                value={newCategoryName}
                placeholder="새 분류 이름 입력 후 Enter..."
                onChange={setNewCategoryName}
                onAdd={addCategory}
                disabled={loading}
              />
            </div>
            <div className="mb-5 rounded-[20px] border border-border bg-card p-5 md:p-8">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">동아리 장르</p>
              <p className="mb-4 text-[13px] leading-relaxed text-fg3">
                매뉴얼에 준비 TO-DO가 비어 있으면, 고른 장르의 표준 운영으로 보충합니다. 미리보기에서 지울 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {CLUB_GENRES.map((item) => {
                  const selected = genre === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGenre(item.id)}
                      className="cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                      style={{
                        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "rgba(0,102,255,0.08)" : "var(--bg)",
                        color: selected ? "var(--accent)" : "var(--fg2)",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {firstEvents || secondEvents || failedHalves.length > 0 ? (
              <p className="mb-3 text-[12px] text-fg3">
                상반기 {firstEvents ? `완료 (${firstEvents.length}건)` : failedHalves.includes("first") ? "실패" : "대기"} · 하반기{" "}
                {secondEvents ? `완료 (${secondEvents.length}건)` : failedHalves.includes("second") ? "실패" : "대기"}
              </p>
            ) : null}
            {loading ? <ParseProgressBar value={parseFill} /> : null}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={reset}
                className="cursor-pointer rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-fg3"
              >
                처음부터
              </button>
              {failedHalves.length === 0 ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void parseWithProfile()}
                  className="font-display flex-1 cursor-pointer rounded-xl bg-accent py-3 text-[15px] font-bold text-white disabled:opacity-60"
                >
                  {loading
                    ? parseStep
                      ? `${parseStep} 추출 중`
                      : "일정 추출 중"
                    : "이 팀 구성으로 행사 추출하기 →"}
                </button>
              ) : (
                failedHalves.map((half) => (
                  <button
                    key={half}
                    type="button"
                    disabled={loading}
                    onClick={() => void parseWithProfile([half])}
                    className="font-display flex-1 cursor-pointer rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loading && parseStep
                      ? `${parseStep} 추출 중`
                      : `${PARSE_HALVES[half].label} 다시 파싱`}
                  </button>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
