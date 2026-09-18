/**
 * 🧭 UniClub - guest-store.ts
 *
 * 로그인 없이 둘러보기(게스트 모드)에서 쓰는 로컬 저장소입니다. 서버(club-data 함수) 대신
 * 브라우저 localStorage에 학년도별로 동아리 데이터를 저장합니다.
 *
 * 📌 주요 기능:
 * - 학년도별 동아리 데이터를 localStorage에 저장/조회 (useClubData의 서버 호출을 대신함)
 * - 게스트 데이터를 통째로 지우는 기능 (설정 탭의 "데이터 초기화" 버튼에서 사용)
 *
 * 💡 팁 및 주의사항:
 * - 이 데이터는 이 브라우저에만 남고, 다른 기기나 로그인 계정으로 이어지지 않습니다.
 * - 저장 형태는 useClubData가 기대하는 { ok, data, seasons } 모양을 그대로 맞춰서,
 *   훅 쪽에서 서버 응답과 동일하게 다룰 수 있게 합니다.
 *
 * @file guest-store.ts
 * @module lib/guest-store
 */
import type { ClubData } from "./types";

const STORAGE_KEY = "uniclub-guest-data-v1";

type GuestClubDataResponse = { ok: true; data: ClubData | null; seasons: number[] };

type GuestBucket = Record<string, ClubData>;

function loadBucket(): GuestBucket {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as GuestBucket;
  } catch {
    return {};
  }
}

function saveBucket(bucket: GuestBucket): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
}

export function fetchGuestClubData(year?: number): GuestClubDataResponse {
  const bucket = loadBucket();
  const seasons = Object.keys(bucket)
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const targetYear = year !== undefined ? year : seasons.at(-1);
  const data = targetYear !== undefined ? (bucket[String(targetYear)] ?? null) : null;
  return { ok: true, data, seasons };
}

export function persistGuestClubData(data: ClubData): void {
  const bucket = loadBucket();
  bucket[String(data.club_info.academic_year)] = data;
  saveBucket(bucket);
}

export function clearGuestClubData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasGuestClubData(): boolean {
  return Object.keys(loadBucket()).length > 0;
}
