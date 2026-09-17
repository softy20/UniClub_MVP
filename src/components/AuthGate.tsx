/**
 * 🧭 UniClub - AuthGate (로그인/회원가입 화면)
 *
 * 앱에 들어오기 전에 보여주는 로그인·회원가입 화면입니다. 이메일/비밀번호로 로그인하거나
 * 가입하고, 구글 계정으로도 로그인할 수 있습니다.
 *
 * 📌 주요 기능:
 * - 로그인 모드와 회원가입 모드를 버튼 하나로 전환합니다.
 * - 이메일과 비밀번호를 입력받아 로그인 또는 회원가입을 진행합니다.
 * - 구글 계정으로 로그인하는 버튼을 제공합니다.
 * - 회원가입이 끝나면 "확인 이메일을 보냈다"는 안내 문구를 보여줍니다.
 * - 로그인이나 가입 중 오류가 나면 화면에 오류 메시지를 보여줍니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * import { AuthGate } from "./components/AuthGate";
 * <AuthGate
 *   onSignIn={(email, password) => signIn(email, password)}
 *   onSignUp={(email, password) => signUp(email, password)}
 *   onSignInWithGoogle={() => signInWithGoogle()}
 * />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): onSignIn(이메일/비밀번호 로그인 함수),
 *   onSignUp(이메일/비밀번호 회원가입 함수), onSignInWithGoogle(구글 로그인 함수)
 * - 컴포넌트 안에서 바뀌는 데이터(State): mode(로그인/회원가입 중 어느 모드인지),
 *   email(입력한 이메일), password(입력한 비밀번호), error(오류 메시지),
 *   submitting(제출 처리 중인지 여부), signupDone(회원가입 완료 여부)
 *
 * 💡 팁 및 주의사항:
 * - 실제 로그인 로직(서버 통신 등)은 이 컴포넌트 밖(onSignIn 등 Props로 전달된 함수)에서
 *   처리하고, 이 파일은 화면과 입력값 관리만 담당합니다.
 * - 비밀번호는 6자 이상이어야 폼 제출이 허용됩니다(HTML minLength 속성으로 검사).
 * - 모드를 전환하면(로그인 ↔ 회원가입) 이전에 보이던 오류 메시지와 가입 완료 안내가 초기화됩니다.
 *
 * @file AuthGate.tsx
 * @module components/AuthGate
 */
import { useState, type FormEvent } from "react";

type AuthGateProps = {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
};

export function AuthGate({ onSignIn, onSignUp, onSignInWithGoogle }: AuthGateProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  async function handleGoogleClick() {
    setError(null);
    try {
      await onSignInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
        setSignupDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setError(null);
    setSignupDone(false);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-[20px] border border-border bg-card p-8">
        <h1 className="font-display text-lg font-bold text-fg">
          {mode === "signin" ? "로그인" : "회원가입"}
        </h1>
        <p className="mt-1 text-[13px] text-fg3">UniClub에 접속하려면 로그인이 필요합니다.</p>

        {signupDone ? (
          <p className="mt-6 rounded-lg border border-border bg-card2 px-3 py-2.5 text-sm text-fg2">
            가입 확인 이메일을 보냈습니다. 메일함을 확인한 뒤 로그인해 주세요.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="이메일"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-[10px] border-[1.5px] border-border bg-bg px-3.5 py-[9px] text-[13px] text-fg outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-[10px] border-[1.5px] border-border bg-bg px-3.5 py-[9px] text-[13px] text-fg outline-none"
            />
            {error ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="font-display mt-1 w-full cursor-pointer rounded-[10px] bg-accent py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "signin" ? "로그인" : "가입하기"}
            </button>
          </form>
        )}

        {!signupDone ? (
          <>
            <div className="mt-4 flex items-center gap-2 text-[12px] text-fg3">
              <div className="h-px flex-1 bg-border" />
              또는
              <div className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={handleGoogleClick}
              className="mt-4 w-full cursor-pointer rounded-[10px] border-[1.5px] border-border bg-card py-2.5 text-sm font-medium text-fg"
            >
              Google로 로그인
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={toggleMode}
          className="mt-4 w-full cursor-pointer text-center text-[13px] font-medium text-fg3"
        >
          {mode === "signin" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </div>
    </div>
  );
}
