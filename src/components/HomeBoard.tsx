import { EventDday } from "./EventDday";
import { TaskRow } from "./TaskList";
import { TODAY, formatDate, formatRange } from "../lib/board";
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
            <p className="text-[12px] text-muted">
              {formatDate(TODAY)} · {formatRange(weekStart, weekEnd)}
            </p>
          </header>
          {thisWeek.length === 0 ? (
            <p className="px-5 py-8 text-[14px] text-muted">이번 주 마감인 일이 없습니다.</p>
          ) : (
            <ul className="flex-1 overflow-auto">
              {thisWeek.map((task) => (
                <TaskRow key={task.id} task={task} done={done.has(task.id)} onToggle={onToggle} />
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
                <TaskRow key={task.id} task={task} done={done.has(task.id)} onToggle={onToggle} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
