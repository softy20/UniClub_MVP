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
