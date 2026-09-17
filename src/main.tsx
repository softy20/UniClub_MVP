import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

function Root() {
  const { session, loading, signIn, signUp, signInWithGoogle, signOut } = useAuth();

  if (loading) return null;
  if (!session) {
    return <AuthGate onSignIn={signIn} onSignUp={signUp} onSignInWithGoogle={signInWithGoogle} />;
  }
  return <App onSignOut={signOut} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
