import { useMemo, useState } from "react";
import club from "./data/club.json";
import { Sidebar } from "./components/Sidebar";
import { EventDday } from "./components/EventDday";
import { TaskRow } from "./components/TaskList";
import {
  TODAY,
  buildBoard,
  formatDate,
  formatRange,
  loadDoneIds,
  saveDoneIds,
} from "./lib/board";
import type { ClubData } from "./lib/types";

const data = club as ClubData;

export default function App() {
  const board = useMemo(() => buildBoard(data, TODAY), []);
  const [done, setDone] = useState<Set<string>>(() => loadDoneIds());

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveDoneIds(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[232px_minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-[minmax(280px,auto)_1fr]">
        <div className="lg:row-span-2 lg:min-h-screen">
          <Sidebar clubName={data.club_info.club_name} year={data.club_info.academic_year} />
        </div>

        <div className="p-4 pb-2 lg:p-5 lg:pr-2.5 lg:pb-2.5">
          <EventDday event={board.upcoming} />
        </div>

        <section className="flex min-h-[280px] flex-col p-4 pt-0 lg:p-5 lg:pl-2.5 lg:pb-2.5">
          <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-line bg-surface">
            <header className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 className="text-[16px] font-semibold tracking-[-0.02em]">할 일 목록</h2>
              <p className="text-[12px] text-muted">
                {formatDate(TODAY)} · {formatRange(board.weekStart, board.weekEnd)}
              </p>
            </header>
            {board.thisWeek.length === 0 ? (
              <p className="px-5 py-8 text-[14px] text-muted">이번 주 마감인 일이 없습니다.</p>
            ) : (
              <ul className="flex-1 overflow-auto">
                {board.thisWeek.map((task) => (
                  <TaskRow key={task.id} task={task} done={done.has(task.id)} onToggle={toggle} />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-[240px] flex-col p-4 pt-2 lg:col-span-2 lg:p-5 lg:pt-2.5">
          <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-line bg-surface">
            <header className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 className="text-[16px] font-semibold tracking-[-0.02em]">다음주 할 일</h2>
              <p className="text-[12px] text-muted">{formatRange(board.nextStart, board.nextEnd)}</p>
            </header>
            {board.nextWeek.length === 0 ? (
              <p className="px-5 py-8 text-[14px] text-muted">다음 주 마감인 일이 없습니다.</p>
            ) : (
              <ul className="flex-1 overflow-auto">
                {board.nextWeek.map((task) => (
                  <TaskRow key={task.id} task={task} done={done.has(task.id)} onToggle={toggle} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
