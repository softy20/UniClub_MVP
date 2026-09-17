/**
 * 🧭 UniClub - useAuth
 *
 * 로그인 상태를 확인하고, 로그인/회원가입/로그아웃 기능을 제공하는
 * 재사용 로직 묶음입니다. 실제 로그인 처리는 Supabase라는 외부 서비스가 해줍니다.
 *
 * 📌 주요 기능:
 * - 앱이 켜질 때 현재 로그인되어 있는지 확인합니다.
 * - 로그인 상태가 바뀔 때마다(로그인/로그아웃) 자동으로 감지해서 화면에 반영합니다.
 * - 이메일과 비밀번호로 로그인(signIn)하는 기능을 제공합니다.
 * - 이메일과 비밀번호로 회원가입(signUp)하는 기능을 제공합니다.
 * - 구글 계정으로 로그인(signInWithGoogle)하는 기능을 제공합니다.
 * - 로그아웃(signOut) 기능을 제공합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * // main.tsx에서 이렇게 가져다 씁니다
 * const { session, user, loading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 반환값 session: 현재 로그인 세션 정보 (로그인 안 했으면 null)
 * - 반환값 user: 현재 로그인한 사용자 정보 (로그인 안 했으면 null)
 * - 반환값 loading: 로그인 상태를 아직 확인 중인지 여부
 * - 반환값 signIn / signUp / signInWithGoogle / signOut: 각각 로그인, 회원가입,
 *   구글 로그인, 로그아웃을 실행하는 함수
 *
 * 💡 팁 및 주의사항:
 * - 로그인/회원가입 중 에러가 나면, 어려운 영어 에러 메시지를 사람이 읽기 쉬운
 *   한국어 메시지로 바꿔서(translateAuthError) 던져줍니다.
 * - 로그인 상태 변화를 실시간으로 구독(onAuthStateChange)하기 때문에, 다른 탭에서
 *   로그아웃해도 이 화면에도 반영될 수 있습니다.
 * - 컴포넌트가 사라질 때 구독을 반드시 해제(unsubscribe)해서 메모리 누수를 막습니다.
 *
 * @file useAuth.ts
 * @module hooks/useAuth
 */
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "../lib/authErrors";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    if (error) throw new Error(translateAuthError(error.message));
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, user: session?.user ?? null, loading, signIn, signUp, signInWithGoogle, signOut };
}
