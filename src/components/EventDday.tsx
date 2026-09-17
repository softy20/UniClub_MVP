/**
 * 🧭 UniClub - EventDday
 *
 * 가장 가까운 다음 행사 하나를 크게 보여주면서, 며칠 남았는지(D-Day)를 알려주는 화면 조각입니다.
 *
 * 📌 주요 기능:
 * - 다가오는 행사가 있으면 행사 이름, 날짜, 장소, 남은 일수(D-숫자 또는 "오늘")를 크게 표시
 * - 다가오는 행사가 없으면 "예정된 행사가 없습니다" 안내 문구를 대신 표시
 *
 * 🔗 사용 예시:
 * ```tsx
 * // HomeBoard.tsx 안에서 홈 화면 상단에 배치되어 사용됩니다.
 * <EventDday event={upcomingEvent} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): event(다가오는 행사 정보, 없으면 null)
 * - 컴포넌트 안에서 바뀌는 데이터(State): 없음
 * - 이 파일이 내보내는 것: EventDday 컴포넌트
 *
 * 💡 팁 및 주의사항:
 * - event가 null일 때와 있을 때 보여주는 화면 구조가 다르니, 둘 다 신경 써서 확인해야 합니다.
 * - 날짜 형식은 이 컴포넌트가 직접 계산하지 않고 lib/board.ts의 formatDate 함수를 그대로 사용합니다.
 *
 * @file EventDday.tsx
 * @module components/EventDday
 */
import type { UpcomingEvent } from "../lib/types";
import { formatDate } from "../lib/board";

type EventDdayProps = {
  event: UpcomingEvent | null;
};

export function EventDday({ event }: EventDdayProps) {
  if (!event) {
    return (
      <section className="flex h-full flex-col justify-between rounded-[12px] border border-line bg-surface p-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">예정된 행사가 없습니다</h1>
        <p className="text-[13px] text-muted">연간 일정에 날짜가 생기면 여기에 표시됩니다.</p>
      </section>
    );
  }

  const label = event.daysLeft === 0 ? "오늘" : `D-${event.daysLeft}`;

  return (
    <section className="flex h-full flex-col justify-between rounded-[12px] border border-line bg-surface p-6">
      <div>
        <h1 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] text-ink">{event.eventName}</h1>
        <p className="mt-2 text-[13px] text-muted">{formatDate(event.eventDate)}</p>
        {event.location ? <p className="mt-1 text-[13px] text-muted">{event.location}</p> : null}
      </div>
      <p className="tabular mt-8 text-[56px] font-semibold leading-none tracking-[-0.04em] text-ink">{label}</p>
    </section>
  );
}
