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
