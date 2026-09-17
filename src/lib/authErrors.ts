/**
 * 🧭 UniClub - authErrors.ts
 *
 * 로그인/회원가입 중에 Supabase가 영어로 보내주는 에러 메시지를, 사용자가 이해하기 쉬운 한국어 문장으로 바꿔주는 파일입니다.
 *
 * 📌 주요 기능:
 * - 자주 나오는 영어 에러 메시지를 미리 정해둔 한국어 문장으로 매칭
 * - "rate limit" 같은 특수 상황은 별도로 감지해서 안내
 * - 매칭되는 메시지가 없으면 무난한 기본 안내 문구 반환
 *
 * 🔗 사용 예시:
 * ```ts
 * // 로그인 폼에서 에러를 사용자에게 보여줄 때 이렇게 씁니다
 * import { translateAuthError } from './authErrors'
 *
 * try {
 *   await supabase.auth.signInWithPassword({ email, password });
 * } catch (error) {
 *   alert(translateAuthError(error.message));
 * }
 * ```
 *
 * 🎯 주요 관리 요소:
 * - translateAuthError(message): 영어 에러 메시지를 한국어 문장으로 바꿔주는 함수
 *
 * 💡 팁 및 주의사항:
 * - 새로운 영어 에러 메시지가 추가되면 MESSAGES 객체에 정확히 같은 문자열(키)을 추가해야 번역됩니다. 대소문자와 철자가 원본과 똑같아야 매칭됩니다.
 * - 목록에 없는 메시지는 전부 "요청에 실패했습니다..."라는 안전한 기본 문구로 처리되어, 영어 원문이 그대로 노출되는 일이 없습니다.
 *
 * @file authErrors.ts
 * @module lib/authErrors
 */

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "Email not confirmed": "이메일 인증이 완료되지 않았습니다. 받은 메일함을 확인해주세요.",
  "User already registered": "이미 가입된 이메일입니다.",
  "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 합니다.",
  "Unable to validate email address: invalid format": "이메일 형식이 올바르지 않습니다.",
};

export function translateAuthError(message: string): string {
  if (MESSAGES[message]) return MESSAGES[message];
  if (message.toLowerCase().includes("rate limit")) {
    return "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.";
  }
  return "요청에 실패했습니다. 잠시 후 다시 시도해주세요.";
}
