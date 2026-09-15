import { Lightbulb } from "@phosphor-icons/react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import clubSample from "../data/club.json";
import {
  classifyManualFile,
  filePayloadForApi,
  HWP_MESSAGE,
  MANUAL_ACCEPT,
  MANUAL_UPLOAD_GUIDE,
  readManualFile,
  type ManualFilePayload,
} from "../lib/manual-file";
import {
  CLUB_GENRES,
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
import { RoleChip } from "./marks";

type Phase = "input" | "clarifying" | "locked" | "parsed";

type StartOk = {
  ok: true;
  club_name: string;
  academic_year: number;
  draft_roles: RoleDefinition[];
  questions: ClarifyingQuestion[];
  assistant_message: string;
  text?: string;
};

type AnswerOk =
  | {
      ok: true;
      status: "clarifying";
      draft_roles: RoleDefinition[];
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
};
const PARSE_TIMEOUT_MESSAGE = "일정 파싱이 시간 제한을 넘었습니다. 문서를 나누거나 다시 시도해 주세요.";
const PARSE_HALVES: Record<ParseHalf, { label: string; chunks: number[][] }> = {
  first: {
    label: "상반기",
    chunks: [
      [1, 2, 3],
      [4, 5, 6],
    ],
  },
  second: {
    label: "하반기",
    chunks: [
      [7, 8, 9],
      [10, 11, 12],
    ],
  },
};

function isTimeoutBody(raw: string): boolean {
  return /TimeoutError|timed?\s*out/i.test(raw);
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message === PARSE_TIMEOUT_MESSAGE || isTimeoutBody(message);
}

function formatMonthRange(months: number[]): string {
  if (months.length === 1) return `${months[0]}월`;
  return `${months[0]}–${months[months.length - 1]}월`;
}

function mergeEvents(...groups: Array<ClubEvent[] | null>): ClubEvent[] {
  const seen = new Set<string>();
  const merged: ClubEvent[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const event of group) {
      if (seen.has(event.event_id)) continue;
      seen.add(event.event_id);
      merged.push(event);
    }
  }
  return merged.sort((a, b) => a.target_month - b.target_month);
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
  return option.is_other === true || option.id === "other" || option.label.includes("기타");
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
  for (const question of questions) {
    const selectedId = selectedByQuestion[question.question];
    const option = question.options.find((item) => item.id === selectedId);
    if (!option) return null;
    if (isOtherOption(option)) {
      const custom = (otherByQuestion[question.question] ?? "").trim();
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
  onApply: (data: ClubData) => void;
};

export function ManualImportWizard({ onApply }: ManualImportWizardProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [filePayload, setFilePayload] = useState<ManualFilePayload | null>(null);
  const [fileError, setFileError] = useState("");
  const [clubName, setClubName] = useState("");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [draftRoles, setDraftRoles] = useState<RoleDefinition[]>([]);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [messages, setMessages] = useState<OnboardingChatMessage[]>([]);
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({});
  const [otherByQuestion, setOtherByQuestion] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [turn, setTurn] = useState(1);
  const [profile, setProfile] = useState<ClubProfile | null>(null);
  const [parsed, setParsed] = useState<ClubData | null>(null);
  const [firstEvents, setFirstEvents] = useState<ClubEvent[] | null>(null);
  const [secondEvents, setSecondEvents] = useState<ClubEvent[] | null>(null);
  const [failedHalves, setFailedHalves] = useState<ParseHalf[]>([]);
  const [parseStep, setParseStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [genre, setGenre] = useState<ClubGenre>("other");

  function reset() {
    setPhase("input");
    setText("");
    setFileName("");
    setFilePayload(null);
    setFileError("");
    setClubName("");
    setAcademicYear(new Date().getFullYear());
    setDraftRoles([]);
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
    setLoading(false);
    setError("");
    setGenre("other");
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

  function composeAnswer(): string | null {
    return composeAnswerFrom(questions, selectedByQuestion, otherByQuestion);
  }

  function openSamplePreview() {
    setError("");
    setParsed(clubSample as ClubData);
    setPhase("parsed");
  }

  async function sendAnswer(contentOverride?: string) {
    const content = (contentOverride ?? composeAnswer() ?? "").trim();
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

  async function requestEvents(months: number[]): Promise<ClubEvent[]> {
    if (!profile) throw new Error("부서표가 없습니다.");
    const result = await postJson<ParseOk>("/.netlify/functions/parse-manual-with-profile", {
      text,
      file: filePayloadForApi(filePayload),
      profile,
      months,
      genre,
    });
    return result.data.events;
  }

  async function requestEventsResilient(months: number[]): Promise<ClubEvent[]> {
    setParseStep(formatMonthRange(months));
    try {
      return await requestEvents(months);
    } catch (error) {
      if (!isTimeoutError(error) || months.length <= 1) throw error;
      const mid = Math.ceil(months.length / 2);
      const left = await requestEventsResilient(months.slice(0, mid));
      const right = await requestEventsResilient(months.slice(mid));
      return mergeEvents(left, right);
    }
  }

  async function parseWithProfile(halves?: ParseHalf[]) {
    if (!profile) return;
    const toRun =
      halves ??
      (["first", "second"] as ParseHalf[]).filter((half) =>
        half === "first" ? firstEvents === null : secondEvents === null,
      );
    const targets = toRun.length > 0 ? toRun : (["first", "second"] as ParseHalf[]);

    setLoading(true);
    setError("");
    const nextFailed = new Set(failedHalves);
    let nextFirst = firstEvents;
    let nextSecond = secondEvents;
    let lastError = "";

    try {
      for (const half of targets) {
        try {
          const collected: ClubEvent[] = [];
          for (const chunk of PARSE_HALVES[half].chunks) {
            collected.push(...(await requestEventsResilient(chunk)));
          }
          const events = mergeEvents(collected);
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
        }
      }

      if (nextFirst && nextSecond && nextFailed.size === 0) {
        setParsed(clubDataFromProfile(profile, mergeEvents(nextFirst, nextSecond), genre));
        setPhase("parsed");
        return;
      }
      if (lastError) setError(lastError);
    } finally {
      setParseStep("");
      setLoading(false);
    }
  }

  const questionCount = Math.max(questions.length, 1);
  const safeQuestionIndex = Math.min(questionIndex, questionCount - 1);
  const currentQuestion = questions[safeQuestionIndex];
  const selectedId = currentQuestion ? selectedByQuestion[currentQuestion.question] : undefined;
  const selectedOption = currentQuestion?.options.find((item) => item.id === selectedId);
  const showOther = selectedOption ? isOtherOption(selectedOption) : false;
  const roleRoster = (profile?.roles ?? draftRoles).map((role) => role.role_name);

  function chooseOption(question: ClarifyingQuestion, option: QuestionOption) {
    const next = { ...selectedByQuestion, [question.question]: option.id };
    setSelectedByQuestion(next);
    setError("");
    if (isOtherOption(option)) return;
    const isLast = questions.length <= 1 || safeQuestionIndex >= questions.length - 1;
    if (!isLast) {
      window.setTimeout(() => setQuestionIndex((index) => Math.min(index + 1, questions.length - 1)), 320);
      return;
    }
    const content = composeAnswerFrom(questions, next, otherByQuestion);
    if (content) void sendAnswer(content);
  }

  if (phase === "parsed" && parsed) {
    return (
      <div className="h-full overflow-y-auto">
        <ManualPreview
          data={parsed}
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

            <div key={currentQuestion?.question ?? "freeform"} className="fade-in rounded-[20px] border border-border bg-card px-10 pt-10 pb-9">
              <p className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
                {currentQuestion ? CATEGORY_LABEL[currentQuestion.category] : "추가 확인"} · 확인 {safeQuestionIndex + 1}단계
              </p>
              <h2 className="font-display mb-2 text-[22px] leading-snug font-bold text-fg">
                {currentQuestion?.question ?? "추가로 알려주실 내용이 있나요?"}
              </h2>
              <p className="mb-7 text-sm leading-relaxed text-fg3">
                {currentQuestion
                  ? "매뉴얼에서 추출한 내용입니다. 선택지를 고르면 다음 질문으로 이동합니다."
                  : "선택지가 없으면 내용을 입력한 뒤 확인을 눌러 주세요."}
              </p>

              {currentQuestion ? (
                <div className="flex flex-col gap-2.5">
                  {currentQuestion.options.map((option) => {
                    const selected = selectedId === option.id;
                    const customOpen = showOther && isOtherOption(option);
                    return (
                      <div key={option.id}>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => chooseOption(currentQuestion, option)}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-[18px] py-3.5 text-left text-sm font-medium text-fg disabled:opacity-60"
                          style={{
                            border: `1.5px solid ${selected || customOpen ? "var(--accent)" : "var(--border)"}`,
                            background: selected
                              ? "rgba(0,102,255,0.06)"
                              : customOpen
                                ? "rgba(0,102,255,0.04)"
                                : "var(--bg)",
                          }}
                        >
                          <span
                            className="flex size-[18px] shrink-0 items-center justify-center rounded-full"
                            style={{
                              border: `2px solid ${selected || customOpen ? "var(--accent)" : "var(--border)"}`,
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
                              autoFocus
                              value={otherByQuestion[currentQuestion.question] ?? ""}
                              onChange={(event) => {
                                setOtherByQuestion((prev) => ({
                                  ...prev,
                                  [currentQuestion.question]: event.target.value,
                                }));
                              }}
                              rows={3}
                              className="w-full rounded-[10px] border-[1.5px] border-accent bg-bg p-3 text-sm text-fg outline-none"
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
                  value={otherByQuestion.freeform ?? ""}
                  onChange={(event) => setOtherByQuestion({ freeform: event.target.value })}
                  rows={4}
                  className="w-full rounded-[10px] border-[1.5px] border-border bg-bg p-3 text-sm text-fg"
                  placeholder="추가로 확정할 내용을 입력하세요."
                />
              )}

              <div className="mt-6 flex items-center gap-3">
                {safeQuestionIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-fg3"
                  >
                    ← 이전 단계로
                  </button>
                ) : null}
                <div className="flex-1" />
                {(showOther || !currentQuestion) && !loading ? (
                  <button
                    type="button"
                    onClick={() => void sendAnswer()}
                    className="font-display cursor-pointer rounded-[10px] bg-accent px-[18px] py-2.5 text-[13px] font-semibold text-white"
                  >
                    확인
                  </button>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={reset} className="mt-4 self-start text-[13px] text-fg3">
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
              <h2 className="font-display mb-2 text-[26px] font-extrabold text-fg">부서/팀 구성을 확인해 주세요</h2>
              <p className="text-sm text-fg3">
                {profile.club_name} · {profile.academic_year}년. 아래 역할 목록 안에서만 일정을 파싱합니다.
              </p>
            </div>
            <div className="mb-5 rounded-[20px] border border-border bg-card p-8">
              <p className="mb-4 text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">현재 팀 목록</p>
              <div className="flex flex-wrap gap-2.5">
                {profile.roles.map((role) => (
                  <RoleChip key={role.role_name} name={role.role_name} roster={roleRoster} />
                ))}
              </div>
              {profile.roles.length === 1 && profile.roles[0].role_name === "공통" ? (
                <p className="mt-4 text-[12px] text-fg3">역할이 없어도 공통으로 일정을 만들 수 있습니다.</p>
              ) : null}
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
            {loading && parseStep ? (
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border2">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
              </div>
            ) : null}
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
                      ? `${parseStep} 파싱 중...`
                      : "일정 파싱 중..."
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
                      ? `${parseStep} 파싱 중...`
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
