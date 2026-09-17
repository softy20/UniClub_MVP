import { useEffect, useState } from "react";
import { patchClubEvent, type ClubEventPatch } from "../lib/club-store";
import type { ClubData } from "../lib/types";

const CLUB_DATA_ENDPOINT = "/.netlify/functions/club-data";

async function fetchClubData(): Promise<ClubData | null> {
  const response = await fetch(CLUB_DATA_ENDPOINT);
  if (!response.ok) throw new Error(`클럽 데이터 조회 실패 (${response.status})`);
  const payload = (await response.json()) as { ok: boolean; data: ClubData | null };
  return payload.data;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchClubData()
      .then((remote) => {
        if (!cancelled && remote) setData(remote);
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

  function persist(next: ClubData) {
    setData(next);
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

  return { data, loading, applyClubData, patchEvent };
}
