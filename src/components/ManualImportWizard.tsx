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
 * - 내부 전용 하위 컴포넌트: FileDropzone(파일 끌어다 놓기), AddRow(부서/분류 추가 입력줄),
 *   ChipRenameInput(이름 바꾸기 입력창), ParseProgressBar(진행률 막대),
 *   ClarifyingBusyBanner(답변 처리 중 안내), ExtractedRolesPanel/ExtractedCategoriesPanel(추출 결과 보여주기)
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
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import clubSample from "../data/club.json";
import { readKst } from "../lib/kst";
import {
  classifyManualFile,
  filePayloadForApi,
  HWP_MESSAGE,
  MANUAL_ACCEPT,
  MANUAL_UPLOAD_GUIDE,
  readManualFile,
  type ManualFilePayload,
} from "../lib/manual-file";
import { hasMonthSections } from "../lib/manual-months";
import { mergeClubEvents, mergeSeasonEvents } from "../lib/parse-events";
import {
  CLUB_GENRES,
  type CategoryDefinition,
  type ClarifyingQuestion,
  type ClubData,
  type ClubEvent,
  type ClubGenre,
  type ClubProfile,
  type OnboardingChatMessage,
  type OnboardingQuestionCategory,
  type QuestionOption,
  type RoleDefinition,
} from "../lib/types";
import { ManualPreview } from "./ManualPreview";
import { RoleChip, Tag } from "./marks";

type Phase = "input" | "clarifying" | "locked" | "parsed";

type StartOk = {
  ok: true;
  club_name: string;
  academic_year: number;
  draft_roles: RoleDefinition[];
  draft_categories: CategoryDefinition[];
  questions: ClarifyingQuestion[];
  assistant_message: string;
  text?: string;
};

type AnswerOk =
  | {
    ok: true;
    status: "clarifying";
    draft_roles: RoleDefinition[];
    draft_categories: CategoryDefinition[];
    questions: ClarifyingQuestion[];
    assistant_message: string;
    turn: number;
  }
  | {
    ok: true;
    status: "locked";
    profile: ClubProfile;
    assistant_message: string;
    turn: number;
  };

type ParseOk = {
  ok: true;
  data: ClubData;
};

type ApiError = { ok?: false; error?: string };

type ParseHalf = "first" | "second";

const MAX_TURNS = 4;
const CATEGORY_LABEL: Record<OnboardingQuestionCategory, string> = {
  roles: "부서 확인",
  aliases: "별칭 확인",
  club_name: "동아리명 확인",
  event_categories: "행사 분류 확인",
};
const PARSE_TIMEOUT_MESSAGE = "일정 파싱이 시간 제한을 넘었습니다. 문서를 나누거나 다시 시도해 주세요.";
const PARSE_SEASONS: { months: number[]; label: string }[] = [
  { months: [12, 1, 2], label: "동계(12–2월)" },
  { months: [3, 4, 5], label: "1학기(3–5월)" },
  { months: [6, 7, 8], label: "하계(6–8월)" },
  { months: [9, 10, 11], label: "2학기(9–11월)" },
];
const PARSE_HALVES: Record<ParseHalf, { label: string; chunks: number[][] }> = {
  first: {
    label: "상반기",
    chunks: PARSE_SEASONS.slice(0, 2).map((season) => season.months),
  },
  second: {
    label: "하반기",
    chunks: PARSE_SEASONS.slice(2).map((season) => season.months),
  },
};

function isTimeoutBody(raw: string): boolean {
  return /TimeoutError|timed?\s*out/i.test(raw);
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message === PARSE_TIMEOUT_MESSAGE || isTimeoutBody(message);
}

const PARSE_CHUNK_TOTAL = PARSE_SEASONS.length;
const PARSE_CHUNK_MS = 9000;
const PARSE_FINISH_MS = 560;
const SHORT_MANUAL_CHARS = 4000;

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function settledChunkCount(half: ParseHalf, events: ClubEvent[] | null, running: ParseHalf[]): number {
  if (running.includes(half)) return 0;
  return events ? PARSE_HALVES[half].chunks.length : 0;
}

function ParseProgressBar({ value }: { value: number }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border2" aria-hidden>
      <div
        className="h-full rounded-full bg-accent"
        style={{
          width: `${width}%`,
          transition:
            width >= 99
              ? "width 520ms cubic-bezier(0.16, 1, 0.3, 1)"
              : "width 120ms linear",
        }}
      />
    </div>
  );
}

function ClarifyingBusyBanner({ label }: { label: string }) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3" role="status" aria-live="polite">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-accent">{label}</p>
        <span className="pulse-dot size-2 rounded-full bg-accent" />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border2" aria-hidden>
        <div className="progress-indeterminate h-full w-[34%] rounded-full bg-accent" />
      </div>
    </div>
  );
}

function formatParseStep(months: number[]): string {
  const found = PARSE_SEASONS.find(
    (season) => season.months.length === months.length && season.months.every((month, index) => month === months[index]),
  );
  if (found) return found.label;
  if (months.length === 1) return `${months[0]}월`;
  return `${months[0]}–${months[months.length - 1]}월`;
}

function clubDataFromProfile(profile: ClubProfile, events: ClubEvent[], genre: ClubGenre): ClubData {
  return {
    club_info: {
      club_name: profile.club_name,
      academic_year: profile.academic_year,
      club_genre: genre,
      roles: profile.roles.map((role) => ({
        role_name: role.role_name,
        ...(role.description ? { description: role.description } : {}),
      })),
    },
    events,
  };
}

function extraAliases(role: RoleDefinition): string[] {
  return role.aliases.map((alias) => alias.trim()).filter((alias) => alias.length > 0 && alias !== role.role_name);
}

function extraCategoryAliases(category: CategoryDefinition): string[] {
  return category.aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0 && alias !== category.label);
}

function isDeptQuestion(question: ClarifyingQuestion | undefined): boolean {
  return question?.category === "roles" || question?.category === "aliases";
}

function isCategoryQuestion(question: ClarifyingQuestion | undefined): boolean {
  return question?.category === "event_categories";
}

function ExtractedRolesPanel({ roles }: { roles: RoleDefinition[] }) {
  if (roles.length === 0) return null;
  const roster = roles.map((role) => role.role_name);
  return (
    <div className="fade-in mb-6 rounded-xl border border-border bg-bg px-4 py-3.5">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">추출된 부서 (별칭 포함)</p>
      <div className="flex flex-col gap-2">
        {roles.flatMap((role) => {
          const aliases = extraAliases(role);
          if (aliases.length === 0) {
            return [
              <div key={role.role_name} className="flex flex-wrap items-center gap-2">
                <RoleChip name={role.role_name} roster={roster} asButton />
              </div>,
            ];
          }
          return aliases.map((alias) => (
            <div key={`${role.role_name}-${alias}`} className="flex flex-wrap items-center gap-2">
              <RoleChip name={alias} roster={roster} accentName={role.role_name} asButton />
              <span className="text-xs text-fg3">→</span>
              <RoleChip name={role.role_name} roster={roster} asButton />
              <span className="rounded-[5px] bg-[rgba(234,179,8,0.1)] px-[7px] py-0.5 text-[11px] font-semibold text-warn">
                별칭 감지됨
              </span>
            </div>
          ));
        })}
      </div>
    </div>
  );
}

function ExtractedCategoriesPanel({ categories }: { categories: CategoryDefinition[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="fade-in mb-6 rounded-xl border border-border bg-bg px-4 py-3.5">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">추출된 행사 분류</p>
      <div className="flex flex-col gap-2">
        {categories.map((category) => {
          const aliases = extraCategoryAliases(category);
          return (
            <div key={category.label} className="flex flex-wrap items-center gap-2">
              <Tag cat={category.label} />
              {aliases.length > 0 ? (
                <span className="text-[12px] text-fg3">별칭 {aliases.join(", ")}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FALLBACK_ROLE: RoleDefinition = {
  role_name: "공통",
  aliases: ["공통업무", "미지정", "미배정", "담당없음"],
};

const FALLBACK_CATEGORY: CategoryDefinition = {
  label: "기타",
  aliases: ["미분류", "기타행사"],
};

function AddRow({
  value,
  placeholder,
  onChange,
  onAdd,
  disabled,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}) {
  function submit() {
    if (disabled) return;
    onAdd();
  }
  return (
    <div className="mt-6 flex gap-2 border-t border-border pt-5">
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") submit();
        }}
        placeholder={placeholder}
        className="flex-1 rounded-[10px] border-[1.5px] border-border bg-bg px-3.5 py-[9px] text-[13px] text-fg outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={submit}
        className="cursor-pointer rounded-[10px] border-0 bg-border px-4 py-[9px] text-[13px] font-semibold text-fg2 disabled:opacity-60"
        disabled={disabled}
      >
        + 추가
      </button>
    </div>
  );
}

function ChipRenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
        }
        if (event.key === "Escape") onCancel();
      }}
      className="rounded-lg border-[1.5px] border-accent bg-bg px-3 py-[5px] text-[13px] font-semibold text-fg outline-none"
    />
  );
}

function FileDropzone({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
    event.target.value = "";
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all"
      style={{
        borderColor: isDragging ? "var(--accent)" : "var(--border2)",
        background: isDragging ? "rgba(0,102,255,0.04)" : "var(--card)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={MANUAL_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="font-display mb-2 text-lg font-semibold text-fg">운영 매뉴얼 업로드</p>
      <p className="text-sm font-medium text-fg2">
        파일을 드래그하여 올리거나 <span className="text-accent underline">여기 클릭</span>하여 탐색기 열기
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {[".md", ".docx", ".pdf", ".txt"].map((ext) => (
          <span
            key={ext}
            className="rounded-md border border-border bg-card2 px-2 py-1 text-[13px] font-semibold text-fg3"
          >
            {ext}
          </span>
        ))}
      </div>
    </div>
  );
}

function isOtherOption(option: QuestionOption): boolean {
  if (option.id === "other" || option.label.includes("직접 입력")) return true;
  return option.is_other === true && !option.label.includes("기타로");
}

function questionKey(question: ClarifyingQuestion, index: number): string {
  return `${index}:${question.category}`;
}

function composeAnswerFrom(
  questions: ClarifyingQuestion[],
  selectedByQuestion: Record<string, string>,
  otherByQuestion: Record<string, string>,
): string | null {
  if (questions.length === 0) {
    const only = Object.values(otherByQuestion).map((value) => value.trim()).find(Boolean);
    return only || null;
  }
  const parts: string[] = [];
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question) return null;
    const key = questionKey(question, index);
    const selectedId = selectedByQuestion[key] ?? selectedByQuestion[question.question];
    const option = question.options.find((item) => item.id === selectedId);
    if (!option) return null;
    if (isOtherOption(option)) {
      const custom = (otherByQuestion[key] ?? otherByQuestion[question.question] ?? "").trim();
      if (!custom) return null;
      parts.push(`${question.question}\n선택: ${option.label}\n입력: ${custom}`);
      continue;
    }
    parts.push(`${question.question}\n선택: ${option.label}`);
  }
  return parts.join("\n\n");
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: T | ApiError | undefined;
  if (raw) {
    try {
      payload = JSON.parse(raw) as T | ApiError;
    } catch {
      if (isTimeoutBody(raw)) throw new Error(PARSE_TIMEOUT_MESSAGE);
      const preview = raw.slice(0, 80).trim();
      throw new Error(preview ? `요청 실패 (${response.status}): ${preview}` : `요청 실패 (${response.status})`);
    }
  }
  if (!response.ok || (payload && typeof payload === "object" && "ok" in payload && payload.ok === false)) {
    const message = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    if (typeof message === "string" && isTimeoutBody(message)) {
      throw new Error(PARSE_TIMEOUT_MESSAGE);
    }
    throw new Error(message || `요청 실패 (${response.status})`);
  }
  if (!payload) throw new Error(`요청 실패 (${response.status})`);
  return payload as T;
}

type ManualImportWizardProps = {
  existingData: ClubData | null;
  onApply: (data: ClubData) => void;
};

export function ManualImportWizard({ existingData, onApply }: ManualImportWizardProps) {
  const [phase, setPhase] = useState<Phase>("input");
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

  function reset() {
    setPhase("input");
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

  function patchProfile(next: ClubProfile) {
    setProfile(next);
    setFirstEvents(null);
    setSecondEvents(null);
    setFailedHalves([]);
    setParsed(null);
  }

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

  async function requestEvents(months?: number[]): Promise<ClubEvent[]> {
    if (!profile) throw new Error("부서표가 없습니다.");
    const result = await postJson<ParseOk>("/.netlify/functions/parse-manual-with-profile", {
      text,
      file: filePayloadForApi(filePayload),
      profile,
      ...(months && months.length > 0 ? { months } : {}),
      genre,
    });
    return result.data.events;
  }

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
  function withSeasonMerge(fresh: ClubData): ClubData {
    if (!existingData) return fresh;
    const year = existingData.club_info.academic_year;
    return {
      ...fresh,
      club_info: { ...fresh.club_info, academic_year: year },
      events: mergeSeasonEvents(existingData.events, fresh.events, year, readKst().civil),
    };
  }

  async function finishParsePreview(data: ClubData) {
    parseFinishingRef.current = true;
    setParseCompleted(PARSE_CHUNK_TOTAL);
    setParseFill(100);
    await waitForPaint();
    await waitMs(PARSE_FINISH_MS);
    setParsed(data);
    setPhase("parsed");
  }

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
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-4">
        {phase === "input" ? (
          <>
            <p className="text-[12px] tracking-widest text-fg3 uppercase">문서 파싱 · 부서표 온보딩</p>
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
                    {MANUAL_UPLOAD_GUIDE} 부서·직책이 없으면 공통으로 진행할 수 있습니다.
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
                placeholder="TXT / MD 내용을 붙여넣거나 위에서 파일을 올리세요."
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
              className="fade-in rounded-[20px] border border-border bg-card px-10 pt-10 pb-9"
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
              <h2 className="font-display mb-2 text-[26px] font-extrabold text-fg">부서와 행사 분류를 확인해 주세요</h2>
              <p className="text-sm text-fg3">
                {profile.club_name} · {profile.academic_year}년. 아래 목록으로 연간 행사를 분류합니다. 추가하거나 삭제한 뒤
                다음으로 넘어가세요.
              </p>
            </div>
            <div className="mb-5 rounded-[20px] border border-border bg-card p-8">
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
            <div className="mb-5 rounded-[20px] border border-border bg-card p-8">
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
            <div className="mb-5 rounded-[20px] border border-border bg-card p-8">
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
