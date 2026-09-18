import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// Vite는 빌드 시 VITE_ 접두사가 붙은 값만 클라이언트 번들에 넣지만, Netlify Functions는
// process.env를 그대로 읽는 Node 런타임이라 같은 .env 파일에서 VITE_ 접두사 없는 값을
// 우선 찾고, 없으면 클라이언트용 값을 그대로 재사용한다. 그래서 이 기능을 위해
// 별도 시크릿을 새로 추가하지 않아도 된다.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

// 요청을 보낸 사용자의 Authorization 헤더를 그대로 실어서 Supabase 클라이언트를 만든다.
// 이러면 이 클라이언트로 하는 모든 쿼리(club_members 조회 등)는 그 사용자 권한
// (RLS의 auth.uid())으로 실행된다.
export function getRequestSupabase(authHeader: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

export async function getRequestUser(req: Request): Promise<{ client: SupabaseClient; user: User } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const client = getRequestSupabase(authHeader);
  // 토큰을 명시적으로 넘겨 검증한다 - 클라이언트 내부 세션 상태에 기대지 않고
  // 이 요청의 Authorization 헤더가 실제로 유효한 로그인 토큰인지 서버에 물어본다.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, user: data.user };
}

export async function isClubMember(client: SupabaseClient, clubId: string, userId: string): Promise<boolean> {
  const { data } = await client
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}
