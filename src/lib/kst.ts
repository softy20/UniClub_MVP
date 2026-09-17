/**
 * 🧭 UniClub - kst.ts
 *
 * 지금이 한국 시간(KST, 서울 시간대)으로 몇 년 몇 월 며칠 몇 시인지 알려주는 파일입니다.
 * 사용자의 컴퓨터가 어느 나라 시간대에 맞춰져 있어도 항상 한국 시간 기준으로 계산합니다.
 *
 * 📌 주요 기능:
 * - 현재 시각(또는 원하는 시각)을 한국 시간 기준 연/월/일/시/분/초/요일로 분해
 * - 분해한 한국 시간을 "2025.03.04 (화) 13:05" 같은 문자열로 예쁘게 포맷
 * - 화면에서 실시간으로 시계가 흘러가도록 1초마다 갱신되는 React 훅 제공
 *
 * 🔗 사용 예시:
 * ```ts
 * // 컴포넌트 안에서 실시간 한국 시간을 보여줄 때
 * import { useKstNow, formatKstDateTime } from './kst'
 *
 * function Clock() {
 *   const now = useKstNow();
 *   return <span>{formatKstDateTime(now)}</span>;
 * }
 * ```
 *
 * 🎯 주요 관리 요소:
 * - KST_TIMEZONE: 한국 시간대 이름("Asia/Seoul")
 * - KstClock: 분해된 한국 시간 정보를 담는 타입 (연,월,일,시,분,초,요일,civil)
 * - readKst(instant?): 특정 시각을 한국 시간 정보로 변환하는 함수
 * - formatKstDateTime(clock): 한국 시간을 문자열로 바꾸는 함수
 * - useKstNow(): 1초마다 갱신되는 현재 한국 시간을 돌려주는 React 훅
 *
 * 💡 팁 및 주의사항:
 * - useKstNow는 매초 리렌더링을 일으키므로, 화면 전체가 아니라 시계를 보여주는 작은 컴포넌트에서만 쓰는 것이 좋습니다.
 * - civil 값은 시:분:초를 12시 정오로 고정한 Date라서, "그날짜"만 비교할 때(디데이 계산 등) 안전하게 쓸 수 있습니다.
 *
 * @file kst.ts
 * @module lib/kst
 */

import { useEffect, useState } from "react";

export const KST_TIMEZONE = "Asia/Seoul";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type KstClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: (typeof WEEKDAYS)[number];
  /** KST calendar day at noon, for D-Day and week ranges. */
  civil: Date;
};

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "0";
}

export function readKst(instant: Date = new Date()): KstClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(instant);

  const year = Number(partValue(parts, "year"));
  const month = Number(partValue(parts, "month"));
  const day = Number(partValue(parts, "day"));
  const hour = Number(partValue(parts, "hour"));
  const minute = Number(partValue(parts, "minute"));
  const second = Number(partValue(parts, "second"));
  const weekdayKo = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    weekday: "short",
  })
    .format(instant)
    .replace("요일", "");
  const weekday = (WEEKDAYS as readonly string[]).includes(weekdayKo)
    ? (weekdayKo as KstClock["weekday"])
    : "일";

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    civil: new Date(year, month - 1, day, 12, 0, 0, 0),
  };
}

export function formatKstDateTime(clock: KstClock): string {
  const yyyy = String(clock.year);
  const mo = String(clock.month).padStart(2, "0");
  const dd = String(clock.day).padStart(2, "0");
  const hh = String(clock.hour).padStart(2, "0");
  const mm = String(clock.minute).padStart(2, "0");
  return `${yyyy}.${mo}.${dd} (${clock.weekday}) ${hh}:${mm}`;
}

export function useKstNow(): KstClock {
  const [clock, setClock] = useState(() => readKst());

  useEffect(() => {
    let intervalId = 0;
    const delay = 1000 - (Date.now() % 1000);
    const timeoutId = window.setTimeout(() => {
      setClock(readKst());
      intervalId = window.setInterval(() => setClock(readKst()), 1000);
    }, delay);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return clock;
}
