import { useState } from "react";
import { extractManualText } from "../lib/manual-file";
import type {
  ClubData,
  ClubProfile,
  OnboardingChatMessage,
  OnboardingQuestion,
  RoleDefinition,
} from "../lib/types";

type Phase = "input" | "clarifying" | "locked" | "parsed";

type StartOk = {
  ok: true;
  club_name: string;
  academic_year: number;
  draft_roles: RoleDefinition[];
  questions: OnboardingQuestion[];
  assistant_message: string;
};

type AnswerOk =
  | {
      ok: true;
      status: "clarifying";
      draft_roles: RoleDefinition[];
      questions: OnboardingQuestion[];
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

const MAX_TURNS = 4;
const ACCEPT = ".txt,.md,.markdown,.docx,.hwp,.hwpx";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T | ApiError;
  if (!response.ok || (payload && typeof payload === "object" && "ok" in payload && payload.ok === false)) {
    const message = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    throw new Error(message || `요청 실패 (${response.status})`);
  }
  return payload as T;
}

export function ManualImportWizard() {
  const [phase, setPhase] = useState<Phase>("input");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [clubName, setClubName] = useState("");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [draftRoles, setDraftRoles] = useState<RoleDefinition[]>([]);
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [messages, setMessages] = useState<OnboardingChatMessage[]>([]);
  const [answer, setAnswer] = useState("");
  const [turn, setTurn] = useState(1);
  const [profile, setProfile] = useState<ClubProfile | null>(null);
  const [parsed, setParsed] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setPhase("input");
    setText("");
    setFileName("");
    setFileError("");
    setClubName("");
    setAcademicYear(new Date().getFullYear());
    setDraftRoles([]);
    setQuestions([]);
    setMessages([]);
    setAnswer("");
    setTurn(1);
    setProfile(null);
    setParsed(null);
    setLoading(false);
    setError("");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileError("");
    setError("");
    setFileName(file.name);
    try {
      setText(await extractManualText(file));
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function startOnboarding() {
    const manual = text.trim();
    if (!manual) {
      setError("매뉴얼 텍스트를 입력하거나 파일을 업로드하세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await postJson<StartOk>("/.netlify/functions/start-onboarding", { text: manual });
      const assistant = result.assistant_message || result.questions.map((item) => item.question).join("\n");
      setClubName(result.club_name);
      setAcademicYear(result.academic_year);
      setDraftRoles(result.draft_roles);
      setQuestions(result.questions);
      setMessages([{ role: "assistant", content: assistant }]);
      setTurn(1);
      setPhase("clarifying");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  async function sendAnswer() {
    const content = answer.trim();
    if (!content) {
      setError("답변을 입력하세요.");
      return;
    }
    const nextTurn = turn + 1;
    const nextMessages: OnboardingChatMessage[] = [...messages, { role: "user", content }];
    setLoading(true);
    setError("");
    try {
      const result = await postJson<AnswerOk>("/.netlify/functions/answer-onboarding", {
        text,
        club_name: clubName,
        academic_year: academicYear,
        draft_roles: draftRoles,
        messages: nextMessages,
        turn: nextTurn,
      });
      const assistant = result.assistant_message;
      setMessages([...nextMessages, { role: "assistant", content: assistant }]);
      setAnswer("");
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

  async function parseWithProfile() {
    if (!profile) return;
    setLoading(true);
    setError("");
    try {
      const result = await postJson<ParseOk>("/.netlify/functions/parse-manual-with-profile", {
        text,
        profile,
      });
      setParsed(result.data);
      setPhase("parsed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <p className="text-[12px] tracking-widest text-fg3 uppercase">M2 부서표 온보딩</p>
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
            <label className="mb-2 block text-sm font-medium text-fg">매뉴얼 텍스트</label>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={14}
              className="mb-3 w-full rounded-lg border border-border bg-card2 p-3 text-sm text-fg"
              placeholder="TXT / MD 내용을 붙여넣거나 파일을 업로드하세요."
            />
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="font-display cursor-pointer rounded-lg border border-border bg-card2 px-3 py-2 text-sm text-fg2">
                파일 업로드
                <input
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(event) => void onFile(event.target.files?.[0])}
                />
              </label>
              <span className="text-[12px] text-fg3">{fileName || "TXT, MD, DOCX · HWP 미지원"}</span>
            </div>
            {fileError ? <p className="mb-3 text-sm text-red-700">{fileError}</p> : null}
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
            {questions.length > 0 ? (
              <ul className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-fg2">
                {questions.map((item) => (
                  <li key={item.question}>[{item.category}] {item.question}</li>
                ))}
              </ul>
            ) : null}
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-card2 p-3 text-sm text-fg"
              placeholder="짧게 답하세요. 예: 홍보와 홍보팀은 같아요. 미지정은 운영팀으로."
            />
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
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void parseWithProfile()}
                className="font-display flex-1 cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "일정 파싱 중..." : "이 구성을 적용하여 일정 파싱"}
              </button>
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
