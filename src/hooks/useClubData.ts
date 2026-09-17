/**
 * 🧭 UniClub - useClubData
 *
 * 동아리 데이터(행사, 임원, 체크리스트 등)를 서버에서 불러오고,
 * 화면에서 바뀐 내용을 다시 서버에 저장해주는 재사용 로직 묶음입니다.
 * (React에서는 이런 재사용 로직 묶음을 "커스텀 훅"이라고 부릅니다.)
 *
 * 📌 주요 기능:
 * - 앱이 처음 열릴 때 서버(Netlify 함수)에서 최신(가장 최근 학년도) 동아리 데이터를 가져옵니다.
 * - 데이터를 불러오는 동안인지(loading) 화면에서 알 수 있게 해줍니다.
 * - 화면에서 데이터를 통째로 바꿀 때(applyClubData) 서버에 저장합니다.
 * - 특정 행사 하나만 부분적으로 수정할 때(patchEvent) 서버에 저장합니다.
 * - 다른 학년도(시즌)로 전환하거나(switchSeason), 지금 시즌을 템플릿 삼아 새 학년도를 시작할 수
 *   있습니다(startNewSeason). 서버는 학년도별로 데이터를 따로 저장하므로 시즌을 바꿔도 다른
 *   학년도 데이터는 지워지지 않습니다.
 * - 서버 저장에 실패해도 화면은 그대로 유지하고, 에러만 콘솔에 기록합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * // App.tsx 등에서 이렇게 가져다 씁니다
 * const { data, loading, seasons, applyClubData, patchEvent, switchSeason, startNewSeason } = useClubData(seed);
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 매개변수(seed): 서버 응답이 오기 전까지 화면에 보여줄 기본 동아리 데이터
 * - 반환값 data: 현재 화면에 표시 중인 동아리 데이터
 * - 반환값 loading: 서버에서 데이터를 불러오는 중인지 여부
 * - 반환값 seasons: 서버에 저장되어 있는 학년도(연도) 목록, 오름차순
 * - 반환값 applyClubData: 동아리 데이터 전체를 새 값으로 바꾸고 저장하는 함수
 * - 반환값 patchEvent: 행사 하나만 콕 집어 수정하고 저장하는 함수
 * - 반환값 switchSeason(year): 다른 학년도 데이터를 불러와서 화면에 보여주는 함수
 * - 반환값 startNewSeason(year): 지금 데이터를 템플릿으로 새 학년도를 만들고 그 시즌으로 전환하는 함수
 *
 * 💡 팁 및 주의사항:
 * - 서버 통신은 "/.netlify/functions/club-data" 주소로 이루어지고, "?season=연도" 쿼리로
 *   특정 학년도를 지정합니다. 생략하면 서버가 가장 최근 학년도를 돌려줍니다.
 * - 화면 업데이트(setData)가 서버 저장보다 먼저 일어나서, 사용자는 기다리지 않고
 *   바로 바뀐 화면을 볼 수 있습니다. (저장은 뒤에서 조용히 진행됩니다.)
 * - 컴포넌트가 화면에서 사라진 뒤에는 이전 요청 결과를 반영하지 않도록
 *   cancelled 플래그로 막아줍니다.
 *
 * @file useClubData.ts
 * @module hooks/useClubData
 */
import { useEffect, useState } from "react";
import { buildSeasonTemplate, patchClubEvent, type ClubEventPatch } from "../lib/club-store";
import type { ClubData } from "../lib/types";

const CLUB_DATA_ENDPOINT = "/.netlify/functions/club-data";

type ClubDataResponse = { ok: boolean; data: ClubData | null; seasons: number[] };

async function fetchClubData(year?: number): Promise<ClubDataResponse> {
  const url = year !== undefined ? `${CLUB_DATA_ENDPOINT}?season=${year}` : CLUB_DATA_ENDPOINT;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`클럽 데이터 조회 실패 (${response.status})`);
  return (await response.json()) as ClubDataResponse;
}

async function persistClubData(data: ClubData): Promise<void> {
  const response = await fetch(CLUB_DATA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`클럽 데이터 저장 실패 (${response.status})`);
}

export function useClubData(seed: ClubData) {
  const [data, setData] = useState<ClubData>(seed);
  const [seasons, setSeasons] = useState<number[]>([seed.club_info.academic_year]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchClubData()
      .then((res) => {
        if (cancelled) return;
        if (res.data) setData(res.data);
        if (res.seasons.length > 0) setSeasons(res.seasons);
      })
      .catch((error) => {
        console.error("클럽 데이터 조회 실패", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function rememberSeason(year: number) {
    setSeasons((prev) => (prev.includes(year) ? prev : [...prev, year].sort((a, b) => a - b)));
  }

  function persist(next: ClubData) {
    setData(next);
    rememberSeason(next.club_info.academic_year);
    persistClubData(next).catch((error) => {
      console.error("클럽 데이터 저장 실패", error);
    });
  }

  function applyClubData(next: ClubData) {
    persist(next);
  }

  function patchEvent(eventId: string, patch: ClubEventPatch) {
    setData((prev) => {
      const next = patchClubEvent(prev, eventId, patch);
      persistClubData(next).catch((error) => {
        console.error("클럽 데이터 저장 실패", error);
      });
      return next;
    });
  }

  function switchSeason(year: number) {
    setLoading(true);
    fetchClubData(year)
      .then((res) => {
        if (res.data) setData(res.data);
        if (res.seasons.length > 0) setSeasons(res.seasons);
      })
      .catch((error) => {
        console.error("시즌 전환 실패", error);
      })
      .finally(() => setLoading(false));
  }

  function startNewSeason(year: number) {
    persist(buildSeasonTemplate(data, year));
  }

  return { data, loading, seasons, applyClubData, patchEvent, switchSeason, startNewSeason };
}
