import { useEffect, useRef, useState } from "react";
import { filePayloadForApi, type ManualFilePayload } from "../../lib/manual-file";
import { hasMonthSections } from "../../lib/manual-months";
import { readKst } from "../../lib/kst";
import { mergeClubEvents, mergeSeasonEvents } from "../../lib/parse-events";
import type { ClubData, ClubEvent, ClubGenre, ClubProfile, ManualImportDepth } from "../../lib/types";
import {
  PARSE_CHUNK_MS,
  PARSE_CHUNK_TOTAL,
  PARSE_FINISH_MS,
  PARSE_HALVES,
  SHORT_MANUAL_CHARS,
} from "./constants";
import type { ParseHalf, ParseOk } from "./types";
import {
  clubDataFromProfile,
  formatParseStep,
  isTimeoutError,
  postJson,
  settledChunkCount,
  waitForPaint,
  waitMs,
} from "./utils";

type UseEventExtractionOptions = {
  text: string;
  filePayload: ManualFilePayload | null;
  profile: ClubProfile | null;
  genre: ClubGenre;
  depth: ManualImportDepth | null;
  existingData: ClubData | null;
  /** 진행률 애니메이션을 돌려야 하는 상태인지(추출 요청 중 + locked 단계) */
  animating: boolean;
  setLoading: (loading: boolean) => void;
  setError: (message: string) => void;
  /** 추출이 끝나고 진행률이 100%로 그려진 뒤 호출된다. 호출 쪽에서 미리보기로 전환한다. */
  onComplete: (data: ClubData) => void;
};

/**
 * 확정된 부서표 기준 일정 추출(서버 요청, 시간 초과 시 구간 분할 재시도, 반기별 성공/실패,
 * 진행률 표시)을 한곳에 모은 훅.
 * @returns 반기별 결과(firstEvents/secondEvents), 실패한 반기, 진행 상태 표시용 값(parseStep/parseFill),
 * 추출 실행(parseWithProfile), 결과 무효화(clearEvents), 전체 초기화(resetExtraction)
 * 특이사항: loading/error는 질문 답변 전송 등 다른 흐름과 공유하는 상태라 호출 쪽에서 내려받는다.
 */
export function useEventExtraction({
  text,
  filePayload,
  profile,
  genre,
  depth,
  existingData,
  animating,
  setLoading,
  setError,
  onComplete,
}: UseEventExtractionOptions) {
  const [firstEvents, setFirstEvents] = useState<ClubEvent[] | null>(null);
  const [secondEvents, setSecondEvents] = useState<ClubEvent[] | null>(null);
  const [failedHalves, setFailedHalves] = useState<ParseHalf[]>([]);
  const [parseStep, setParseStep] = useState("");
  const [parseCompleted, setParseCompleted] = useState(0);
  const [parseFill, setParseFill] = useState(0);
  const parseFinishingRef = useRef(false);

  /**
   * 이미 뽑아 둔 반기별 결과와 실패 기록을 비운다(진행률 값은 건드리지 않음).
   * 특이사항: 부서/분류가 바뀌어 이전 추출 결과가 무효가 될 때 호출한다.
   */
  function clearEvents() {
    setFirstEvents(null);
    setSecondEvents(null);
    setFailedHalves([]);
  }

  /** 결과와 진행 상태(단계 라벨, 완료 구간 수, 진행률)를 모두 초기값으로 되돌린다. */
  function resetExtraction() {
    clearEvents();
    setParseStep("");
    setParseCompleted(0);
    setParseFill(0);
  }

  /**
   * 확정된 부서표(profile) 기준으로 서버(parse-manual-with-profile)에 일정 추출을 요청한다.
   * @param months - 특정 월들만 추출할 때 지정(예: [3,4,5]). 생략하면 매뉴얼 전체를 한 번에 추출한다.
   */
  async function requestEvents(months?: number[]): Promise<ClubEvent[]> {
    if (!profile) throw new Error("부서표가 없습니다.");
    const result = await postJson<ParseOk>("/.netlify/functions/parse-manual-with-profile", {
      text,
      file: filePayloadForApi(filePayload),
      profile,
      ...(months && months.length > 0 ? { months } : {}),
      genre,
      depth,
    });
    return result.data.events;
  }

  /**
   * 지정된 월 구간의 일정을 추출하되, 서버가 시간 초과로 실패하면 구간을 절반으로 쪼개서
   * 재귀적으로 다시 시도한다.
   * 특이사항: 시간 초과가 아닌 다른 에러이거나 더 이상 쪼갤 수 없는 단일 월(months.length<=1)이면
   * 그대로 에러를 던진다. 진행 상황 표시를 위해 요청 전에 setParseStep으로 현재 구간 라벨을
   * 갱신한다.
   */
  async function requestEventsResilient(months: number[]): Promise<ClubEvent[]> {
    setParseStep(formatParseStep(months));
    try {
      return await requestEvents(months);
    } catch (error) {
      if (!isTimeoutError(error) || months.length <= 1) throw error;
      const mid = Math.ceil(months.length / 2);
      const left = await requestEventsResilient(months.slice(0, mid));
      const right = await requestEventsResilient(months.slice(mid));
      return mergeClubEvents(left, right);
    }
  }

  // 지금 시즌에 이미 저장된 데이터가 있으면, 새로 파싱한 결과를 그 위에 안전하게 얹는다
  // (기존 행사는 절대 안 바꾸고, 새 행사·새 할 일만 추가 — mergeSeasonEvents 참고).
  /**
   * 새로 파싱한 ClubData(fresh)를 기존 시즌 데이터(existingData)와 병합한다.
   * @returns existingData가 없으면 fresh를 그대로, 있으면 academic_year를 기존 값으로 맞추고
   * 이벤트를 mergeSeasonEvents로 병합한 결과
   */
  function withSeasonMerge(fresh: ClubData): ClubData {
    if (!existingData) return fresh;
    const year = existingData.club_info.academic_year;
    return {
      ...fresh,
      club_info: { ...fresh.club_info, academic_year: year },
      events: mergeSeasonEvents(existingData.events, fresh.events, year, readKst().civil),
    };
  }

  /**
   * 일정 추출이 끝났을 때, 진행률을 100%로 채우고 화면에 반영될 때까지 잠깐 기다린 뒤
   * 미리보기 화면(phase="parsed")으로 전환한다.
   * 특이사항: parseFinishingRef를 true로 표시해서, 진행률 애니메이션 useEffect가 더 이상
   * 진행률을 임의로 계산하지 않고 100%로 고정되게 한다.
   */
  async function finishParsePreview(data: ClubData) {
    parseFinishingRef.current = true;
    setParseCompleted(PARSE_CHUNK_TOTAL);
    setParseFill(100);
    await waitForPaint();
    await waitMs(PARSE_FINISH_MS);
    onComplete(data);
  }

  /**
   * 확정된 부서표를 기준으로 실제 행사 일정을 추출하는 메인 파이프라인.
   * @param halves - 재시도할 반기만 지정(예: 실패한 "first"만 다시). 생략하면 아직 완료되지
   * 않은 반기들을 자동으로 골라 진행한다.
   * 특이사항:
   * - 매뉴얼이 짧고(SHORT_MANUAL_CHARS 미만) 월별 구분이 없으면, 반기로 나누지 않고 한 번에
   *   ("연간 일정") 추출한다.
   * - 그 외에는 상반기/하반기(PARSE_HALVES)를 계절 단위 구간으로 나눠 순서대로 요청하고
   *   (requestEventsResilient가 시간 초과 시 알아서 더 잘게 쪼갠다), 구간이 끝날 때마다
   *   진행률(parseCompleted/parseFill)을 갱신한다.
   * - 한쪽 반기가 실패해도 다른 반기는 계속 진행하며, 실패한 반기는 failedHalves에 남겨서
   *   화면에서 개별적으로 "다시 파싱"할 수 있게 한다.
   * - 양쪽 반기가 모두 성공하면 두 결과를 합쳐 finishParsePreview로 미리보기 화면으로 넘어간다.
   */
  async function parseWithProfile(halves?: ParseHalf[]) {
    if (!profile) return;

    setLoading(true);
    setError("");
    parseFinishingRef.current = false;

    if (!halves && text.trim().length > 0 && text.trim().length < SHORT_MANUAL_CHARS && !hasMonthSections(text)) {
      setParseCompleted(0);
      setParseFill(8);
      setParseStep("연간 일정");
      try {
        const events = await requestEvents();
        await finishParsePreview(withSeasonMerge(clubDataFromProfile(profile, mergeClubEvents(events), genre)));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setParseStep("");
        setLoading(false);
      }
      return;
    }

    const toRun =
      halves ??
      (["first", "second"] as ParseHalf[]).filter((half) =>
        half === "first" ? firstEvents === null : secondEvents === null,
      );
    const targets = toRun.length > 0 ? toRun : (["first", "second"] as ParseHalf[]);

    const nextFailed = new Set(failedHalves);
    let nextFirst = firstEvents;
    let nextSecond = secondEvents;
    let lastError = "";
    let completed =
      settledChunkCount("first", firstEvents, targets) + settledChunkCount("second", secondEvents, targets);
    setParseCompleted(completed);
    setParseFill(completed === 0 ? 6 : (completed / PARSE_CHUNK_TOTAL) * 100);
    const firstChunk = PARSE_HALVES[targets[0]]?.chunks[0];
    if (firstChunk) setParseStep(formatParseStep(firstChunk));

    try {
      for (const half of targets) {
        const chunks = PARSE_HALVES[half].chunks;
        const halfBase = completed;
        try {
          const collected: ClubEvent[] = [];
          for (const chunk of chunks) {
            collected.push(...(await requestEventsResilient(chunk)));
            completed += 1;
            setParseCompleted(completed);
            setParseFill((fill) => Math.max(fill, (completed / PARSE_CHUNK_TOTAL) * 100));
          }
          const events = mergeClubEvents(collected);
          if (half === "first") nextFirst = events;
          else nextSecond = events;
          nextFailed.delete(half);
          setFirstEvents(nextFirst);
          setSecondEvents(nextSecond);
          setFailedHalves([...nextFailed]);
        } catch (cause) {
          nextFailed.add(half);
          lastError = cause instanceof Error ? cause.message : String(cause);
          setFailedHalves([...nextFailed]);
          completed = halfBase + chunks.length;
          setParseCompleted(completed);
          setParseFill((fill) => Math.max(fill, (completed / PARSE_CHUNK_TOTAL) * 100));
        }
      }

      if (nextFirst && nextSecond && nextFailed.size === 0) {
        await finishParsePreview(
          withSeasonMerge(clubDataFromProfile(profile, mergeClubEvents(nextFirst, nextSecond), genre)),
        );
        return;
      }
      if (lastError) setError(lastError);
    } finally {
      setParseStep("");
      setLoading(false);
    }
  }

  // 실제 진행 상황(parseCompleted, 몇 구간이 끝났는지)과는 별개로, 진행률 막대가 매끄럽게
  // 채워지는 것처럼 보이도록 100ms마다 값을 계산해서 흉내 내는 애니메이션이다. 남은 구간 수 기준
  // 예상 소요 시간(PARSE_CHUNK_MS)까지는 선형에 가깝게, 그 이후로는 지수 감쇠로 97%까지만
  // 서서히 다가가다가(실제로 다 끝나기 전에 100%처럼 보이지 않도록) finishParsePreview가
  // parseFinishingRef를 세우면 그때 100%로 마무리된다.
  useEffect(() => {
    if (!animating) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setParseFill((current) => {
        if (parseFinishingRef.current || parseCompleted >= PARSE_CHUNK_TOTAL) return 100;
        const floor = (parseCompleted / PARSE_CHUNK_TOTAL) * 100;
        const remaining = PARSE_CHUNK_TOTAL - parseCompleted;
        const span = 100 - floor;
        const expected = remaining * PARSE_CHUNK_MS;
        const t = (Date.now() - startedAt) / expected;
        const head = 0.86;
        const tail = 0.97;
        const portion =
          t <= head ? t : head + (tail - head) * (1 - Math.exp(-(t - head) / 0.45));
        const target = floor + span * Math.min(tail, portion);
        return Math.min(97, Math.max(current, floor, 6, target));
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [animating, parseCompleted]);

  return {
    firstEvents,
    secondEvents,
    failedHalves,
    parseStep,
    parseFill,
    parseWithProfile,
    clearEvents,
    resetExtraction,
  };
}
