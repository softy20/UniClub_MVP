/**
 * 🧭 UniClub - main
 *
 * 이 앱이 브라우저에서 켜질 때 가장 먼저 실행되는 파일입니다.
 * 로그인 여부를 확인해서, 로그인 화면 또는 메인 화면 중 하나를 보여줍니다.
 *
 * 📌 주요 기능:
 * - React 앱을 실제 웹페이지의 div#root 위치에 그려줍니다.
 * - 로그인 상태를 확인하는 동안에는 아무것도 보여주지 않습니다(로딩 처리).
 * - 로그인이 안 되어 있으면 로그인/회원가입 화면(AuthGate)을 보여줍니다.
 * - 로그인이 되어 있으면 메인 화면(App)을 보여줍니다.
 * - 공통 스타일 파일(index.css)을 불러와 앱 전체에 적용합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * // 이 파일은 다른 곳에서 import하지 않고, 빌드 도구(Vite)가 진입점으로 직접 실행합니다.
 * // index.html의 <div id="root"></div> 안에 앱 화면이 그려집니다.
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 내부 컴포넌트 Root: 로그인 여부에 따라 AuthGate 또는 App을 보여주는 역할
 * - useAuth 훅에서 가져오는 값: session, loading, signIn, signUp, signInWithGoogle, signOut
 * - createRoot(...).render(...): 실제로 화면을 그려주는 React의 시작 지점
 *
 * 💡 팁 및 주의사항:
 * - StrictMode는 개발 중 실수를 더 잘 찾아내기 위한 안전장치이며,
 *   실제 서비스 동작 방식을 바꾸지는 않습니다.
 * - loading이 true인 동안 null을 반환해서 빈 화면을 보여주는데, 이는 로그인 확인이
 *   끝나기 전에 로그인 화면이 잠깐 깜빡이는 것을 막기 위함입니다.
 *
 * @file main.tsx
 * @module main
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

function Root() {
  const { session, loading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [guest, setGuest] = useState(false);

  if (loading) return null;
  if (session) {
    return <App onSignOut={signOut} userEmail={session.user.email ?? null} />;
  }
  if (guest) {
    return <App isGuest onSignOut={() => setGuest(false)} />;
  }
  return (
    <AuthGate
      onSignIn={signIn}
      onSignUp={signUp}
      onSignInWithGoogle={signInWithGoogle}
      onGuestMode={() => setGuest(true)}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
