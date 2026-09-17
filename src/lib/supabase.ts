/**
 * 🧭 UniClub - supabase.ts
 *
 * Supabase(로그인, 데이터베이스 등을 제공하는 외부 서비스)에 연결하는 "접속 창구"를 만드는 파일입니다.
 * 이 파일에서 만든 supabase 객체를 통해 로그인, 회원가입, 데이터 저장/조회 같은 기능을 사용합니다.
 *
 * 📌 주요 기능:
 * - 환경변수(.env)에서 Supabase 프로젝트 주소와 공개 키를 읽어오기
 * - 환경변수가 없으면 바로 에러를 던져서 실수를 빨리 알아채게 하기
 * - Supabase 클라이언트(연결 객체)를 하나 만들어서 다른 파일에서 재사용할 수 있게 내보내기
 *
 * 🔗 사용 예시:
 * ```ts
 * // 로그인 기능이 필요한 파일에서 이렇게 씁니다
 * import { supabase } from './supabase'
 *
 * const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 * ```
 *
 * 🎯 주요 관리 요소:
 * - supabase: 프로젝트 전체에서 공유해서 쓰는 Supabase 연결 객체
 *
 * 💡 팁 및 주의사항:
 * - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 환경변수가 .env 파일에 반드시 설정되어 있어야 합니다. 없으면 앱이 시작하자마자 에러가 납니다.
 * - 이 파일은 앱 전체에서 딱 하나의 supabase 객체만 만들어 쓰도록(싱글턴) 설계되어 있으니, 새로 createClient를 호출하지 말고 이 파일의 supabase를 import해서 쓰세요.
 *
 * @file supabase.ts
 * @module lib/supabase
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
