/**
 * 🧭 UniClub - HomeBoard
 *
 * 앱의 홈 화면을 구성하는 컴포넌트입니다. 다가오는 행사, 이번 주 할 일, 다음 주 할 일을 한 화면에 모아 보여줍니다.
 *
 * 📌 주요 기능:
 * - 가장 가까운 행사 정보를 EventDday 컴포넌트로 보여줌
 * - 이번 주에 마감인 할 일 목록을 보여주고, 없으면 안내 문구 표시
 * - 다음 주에 마감인 할 일 목록을 보여주고, 없으면 안내 문구 표시
 * - 각 할 일 옆에는 현재 시각과 주간 날짜 범위(예: "9/15 ~ 9/21")를 함께 표시
 *
 * 🔗 사용 예시:
 * ```tsx
 * // App.tsx 같은 상위 화면에서 홈 탭을 구성할 때 사용합니다.
 * <HomeBoard
 *   upcoming={upcomingEvent}
 *   thisWeek={thisWeekTasks}
 *   nextWeek={nextWeekTasks}
 *   weekStart={weekStart}
 *   weekEnd={weekEnd}
 *   nextStart={nextStart}
 *   nextEnd={nextEnd}
 *   done={doneTaskIds}
 *   onToggle={toggleTask}
 *   clock={kstClock}
 * />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): upcoming(다가오는 행사), thisWeek/nextWeek(할 일 목록),
 *   weekStart/weekEnd/nextStart/nextEnd(주간 날짜 범위), done(완료된 할 일 id 모음),
 *   onToggle(할 일 완료 체크 함수), clock(한국 시간 기준 현재 시각 정보)
 * - 컴포넌트 안에서 바뀌는 데이터(State): 없음 (모든 상태는 상위 컴포넌트에서 관리하고 여기로 전달받음)
 * - 이 파일이 내보내는 것: HomeBoard 컴포넌트
 *
 * 💡 팁 및 주의사항:
 * - 이 컴포넌트는 화면을 그리기만 하고, 데이터를 직접 바꾸지 않습니다. 실제 할 일 완료 처리는 onToggle을 통해 상위로 전달됩니다.
 * - 할 일 한 줄 한 줄은 TaskList.tsx의 TaskRow 컴포넌트를 재사용해서 그립니다.
 *
 * @file HomeBoard.tsx
 * @module components/HomeBoard
 */
import { EventDday } from "./EventDday";
import { TaskRow } from "./TaskList";
import { formatRange } from "../lib/board";
import { formatKstDateTime, type KstClock } from "../lib/kst";
import type { BoardTask, UpcomingEvent } from "../lib/types";

type HomeBoardProps = {
  upcoming: UpcomingEvent | null;
  thisWeek: BoardTask[];
  nextWeek: BoardTask[];
  weekStart: Date;
  weekEnd: Date;
  nextStart: Date;
  nextEnd: Date;
  done: Set<string>;
  onToggle: (id: string) => void;
  clock: KstClock;
};

export function HomeBoard({
  upcoming,
  thisWeek,
  nextWeek,
  weekStart,
  weekEnd,
  nextStart,
  nextEnd,
  done,
  onToggle,
  clock,
}: HomeBoardProps) {
  return (
    <>
      <div className="p-4 pb-2 lg:p-5 lg:pr-2.5 lg:pb-2.5">
        <EventDday event={upcoming} />
      </div>

      <section className="flex min-h-[280px] flex-col p-4 pt-0 lg:p-5 lg:pl-2.5 lg:pb-2.5">
        <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-line bg-surface">
          <header className="flex items-baseline justify-between border-b border-line px-5 py-4">
            <h2 className="text-[16px] font-semibold tracking-[-0.02em]">할 일 목록</h2>
            <p className="tabular text-[12px] text-muted">
              {formatKstDateTime(clock)} · {formatRange(weekStart, weekEnd)}
            </p>
          </header>
          {thisWeek.length === 0 ? (
            <p className="px-5 py-8 text-[14px] text-muted">이번 주 마감인 일이 없습니다.</p>
          ) : (
            <ul className="flex-1 overflow-auto">
              {thisWeek.map((task) => (
                <TaskRow key={task.id} task={task} done={done.has(task.id)} onToggle={onToggle} today={clock.civil} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex min-h-[240px] flex-col p-4 pt-2 lg:col-span-2 lg:p-5 lg:pt-2.5">
        <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-line bg-surface">
          <header className="flex items-baseline justify-between border-b border-line px-5 py-4">
            <h2 className="text-[16px] font-semibold tracking-[-0.02em]">다음주 할 일</h2>
            <p className="text-[12px] text-muted">{formatRange(nextStart, nextEnd)}</p>
          </header>
          {nextWeek.length === 0 ? (
            <p className="px-5 py-8 text-[14px] text-muted">다음 주 마감인 일이 없습니다.</p>
          ) : (
            <ul className="flex-1 overflow-auto">
              {nextWeek.map((task) => (
                <TaskRow key={task.id} task={task} done={done.has(task.id)} onToggle={onToggle} today={clock.civil} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
