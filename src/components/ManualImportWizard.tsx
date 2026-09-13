import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  classifyManualFile,
  filePayloadForApi,
  HWP_MESSAGE,
  MANUAL_ACCEPT,
  MANUAL_SIZE_GUIDE,
  MANUAL_UPLOAD_GUIDE,
  readManualFile,
  type ManualFilePayload,
} from "../lib/manual-file";
import type {
  ClarifyingQuestion,
  ClubData,
  ClubEvent,
  ClubProfile,
  OnboardingChatMessage,
  QuestionOption,
  RoleDefinition,
} from "../lib/types";

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

function clubDataFromProfile(profile: ClubProfile, events: ClubEvent[]): ClubData {
  return {
    club_info: {
      club_name: profile.club_name,
      academic_year: profile.academic_year,
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
      className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center"
      style={{
        borderColor: isDragging ? "var(--accent)" : "var(--border2)",
        background: isDragging ? "var(--color-nav-active)" : "var(--card2)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={MANUAL_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-sm font-medium text-fg2">
        파일을 드래그하여 올리거나 <span className="text-accent underline">여기 클릭</span>하여 탐색기 열기
      </p>
      <p className="mt-2 text-[12px] text-fg3">DOCX, PDF, TXT, MD 지원</p>
    </div>
  );
}

function isOtherOption(option: QuestionOption): boolean {
  return option.is_other === true || option.id === "other" || option.label.includes("기타");
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

export function ManualImportWizard() {
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
  const [turn, setTurn] = useState(1);
  const [profile, setProfile] = useState<ClubProfile | null>(null);
  const [parsed, setParsed] = useState<ClubData | null>(null);
  const [firstEvents, setFirstEvents] = useState<ClubEvent[] | null>(null);
  const [secondEvents, setSecondEvents] = useState<ClubEvent[] | null>(null);
  const [failedHalves, setFailedHalves] = useState<ParseHalf[]>([]);
  const [parseStep, setParseStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setTurn(1);
    setProfile(null);
    setParsed(null);
    setFirstEvents(null);
    setSecondEvents(null);
    setFailedHalves([]);
    setParseStep("");
    setLoading(false);
    setError("");
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
        setParsed(clubDataFromProfile(profile, mergeEvents(nextFirst, nextSecond)));
        setPhase("parsed");
        return;
      }
      if (lastError) setError(lastError);
    } finally {
      setParseStep("");
      setLoading(false);
    }
  }

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <p className="text-[12px] tracking-widest text-fg3 uppercase">문서 파싱 · 부서표 온보딩</p>
        <ol className="flex flex-wrap gap-2 text-[12px] text-fg3">
          {(["input", "clarifying", "locked", "parsed"] as Phase[]).map((step) => (
            <li
              key={step}
              className="rounded-md border px-2 py-1"
              style={{
                borderColor: phase === step ? "var(--color-nav-line)" : "var(--border)",
                color: phase === step ? "var(--accent2)" : "var(--fg3)",
                background: phase === step ? "var(--color-nav-active)" : "var(--card)",
              }}
            >
              {step}
            </li>
          ))}
        </ol>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {phase === "input" ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 rounded-lg border border-border bg-card2 p-3 text-[13px] text-fg2">
              <p className="mb-1 font-medium text-fg">파일 업로드 가이드</p>
              <p>{MANUAL_UPLOAD_GUIDE}</p>
              <p className="mt-1">{MANUAL_SIZE_GUIDE}</p>
              <p className="mt-1">지원: DOCX, PDF, TXT, MD. 부서/직책이 없으면 공통으로 진행할 수 있습니다.</p>
            </div>
            <div className="mb-3">
              <FileDropzone onFileSelect={(file) => void onFile(file)} />
              {fileName ? <p className="mt-2 text-[12px] text-fg3">선택됨: {fileName}</p> : null}
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
              rows={14}
              className="mb-3 w-full rounded-lg border border-border bg-card2 p-3 text-sm text-fg"
              placeholder="TXT / MD 내용을 붙여넣거나 위에서 파일을 올리세요."
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void startOnboarding()}
              className="font-display w-full cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "부서 초안 추출 중..." : "부서 초안 추출"}
            </button>
          </section>
        ) : null}

        {phase === "clarifying" ? (
          <section className="flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-xs text-fg3">
                부서 초안 · {turn}/{MAX_TURNS}턴
              </p>
              <ul className="flex flex-col gap-1 text-sm text-fg">
                {draftRoles.map((role) => (
                  <li key={role.role_name}>
                    {role.role_name}
                    {role.aliases.length > 0 ? ` (${role.aliases.join(", ")})` : ""}
                  </li>
                ))}
              </ul>
              {draftRoles.length === 1 && draftRoles[0].role_name === "공통" ? (
                <p className="mt-2 text-[12px] text-fg3">역할이 없어도 공통으로 일정을 만들 수 있습니다.</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap"
                  style={{ background: message.role === "assistant" ? "var(--card2)" : "var(--card)" }}
                >
                  <p className="mb-1 text-[11px] tracking-widest text-fg3 uppercase">
                    {message.role === "assistant" ? "AI" : "사용자"}
                  </p>
                  {message.content}
                </div>
              ))}
            </div>
            {questions.map((question) => {
              const selectedId = selectedByQuestion[question.question];
              const selectedOption = question.options.find((item) => item.id === selectedId);
              const showOther = selectedOption ? isOtherOption(selectedOption) : false;
              return (
                <div key={question.question} className="rounded-lg border border-border bg-card p-3">
                  <p className="mb-2 text-[11px] tracking-widest text-fg3 uppercase">{question.category}</p>
                  <p className="mb-3 text-sm text-fg">{question.question}</p>
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option) => {
                      const selected = selectedId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            const next = { ...selectedByQuestion, [question.question]: option.id };
                            setSelectedByQuestion(next);
                            setError("");
                            if (isOtherOption(option)) return;
                            if (questions.length === 1) {
                              void sendAnswer(`${question.question}\n선택: ${option.label}`);
                            }
                          }}
                          className="cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                          style={{
                            borderColor: selected ? "var(--color-nav-line)" : "var(--border)",
                            background: selected ? "var(--color-nav-active)" : "var(--card2)",
                            color: selected ? "var(--accent2)" : "var(--fg)",
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {showOther ? (
                    <textarea
                      value={otherByQuestion[question.question] ?? ""}
                      onChange={(event) => {
                        setOtherByQuestion((prev) => ({ ...prev, [question.question]: event.target.value }));
                      }}
                      rows={3}
                      className="mt-3 w-full rounded-lg border border-border bg-card2 p-3 text-sm text-fg"
                      placeholder="이 질문에 대한 기타 내용을 입력하세요."
                    />
                  ) : null}
                </div>
              );
            })}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void sendAnswer()}
                className="font-display flex-1 cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "확인 중..." : "답변 보내기"}
              </button>
              <button type="button" onClick={reset} className="rounded-lg border border-border px-4 text-sm text-fg3">
                처음부터
              </button>
            </div>
          </section>
        ) : null}

        {phase === "locked" && profile ? (
          <section className="flex flex-col gap-3">
            <p className="text-sm text-fg2">부서표가 잠겼습니다. 이 역할 목록 안에서만 일정을 파싱합니다.</p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-[#111118] p-4 text-xs text-cyan-200">
              {JSON.stringify(profile, null, 2)}
            </pre>
            {firstEvents || secondEvents || failedHalves.length > 0 ? (
              <p className="text-[12px] text-fg3">
                상반기 {firstEvents ? `완료 (${firstEvents.length}건)` : failedHalves.includes("first") ? "실패" : "대기"} · 하반기{" "}
                {secondEvents ? `완료 (${secondEvents.length}건)` : failedHalves.includes("second") ? "실패" : "대기"}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {failedHalves.length === 0 ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void parseWithProfile()}
                  className="font-display flex-1 cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading
                    ? parseStep
                      ? `${parseStep} 파싱 중...`
                      : "일정 파싱 중..."
                    : "이 구성을 적용하여 일정 파싱"}
                </button>
              ) : (
                failedHalves.map((half) => (
                  <button
                    key={half}
                    type="button"
                    disabled={loading}
                    onClick={() => void parseWithProfile([half])}
                    className="font-display flex-1 cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loading && parseStep
                      ? `${parseStep} 파싱 중...`
                      : `${PARSE_HALVES[half].label} 다시 파싱`}
                  </button>
                ))
              )}
              <button type="button" onClick={reset} className="rounded-lg border border-border px-4 text-sm text-fg3">
                처음부터
              </button>
            </div>
          </section>
        ) : null}

        {phase === "parsed" && parsed ? (
          <section className="flex flex-col gap-3">
            <p className="text-sm text-fg2">고정 부서표로 파싱된 연간 계획 JSON입니다. 보드에는 동기화하지 않습니다.</p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-[#111118] p-4 text-xs text-cyan-200">
              {JSON.stringify(parsed, null, 2)}
            </pre>
            <button type="button" onClick={reset} className="rounded-lg border border-border px-4 py-2 text-sm text-fg3">
              처음부터
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
