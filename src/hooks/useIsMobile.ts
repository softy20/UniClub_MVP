/**
 * 화면 너비가 모바일 구간인지 알려주는 훅입니다.
 * Figma Make(Team To-Do List Calendar)와 같이 768px 미만을 모바일로 봅니다.
 *
 * @file useIsMobile.ts
 * @module hooks/useIsMobile
 */
import { useEffect, useState } from "react";

const MOBILE_MAX = 767;

/**
 * 현재 화면 너비가 모바일 구간(768px 미만)인지 구독해서 알려주는 훅.
 * @returns 모바일 구간이면 true
 * 특이사항: matchMedia change 이벤트로 리사이즈/뷰포트 변화를 실시간 반영하고, 언마운트 시 구독을 해제한다.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth <= MOBILE_MAX,
  );

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    function sync() {
      setIsMobile(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
