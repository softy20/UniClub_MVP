import { useMemo, useState } from "react";
import club from "./data/club.json";
import { HomeBoard } from "./components/HomeBoard";
import { Sidebar, type AppPage } from "./components/Sidebar";
import { YearCalendar } from "./components/YearCalendar";
import { buildBoard, loadDoneIds, saveDoneIds } from "./lib/board";
import { useKstNow } from "./lib/kst";
import type { ClubData } from "./lib/types";

const data = club as ClubData;

export default function App() {
  const clock = useKstNow();
  const board = useMemo(
    () => buildBoard(data, clock.civil),
    [clock.year, clock.month, clock.day],
  );
  const [page, setPage] = useState<AppPage>("year");
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
      {page === "home" ? (
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[232px_minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-[minmax(280px,auto)_1fr]">
          <div className="lg:row-span-2 lg:min-h-screen">
            <Sidebar
              clubName={data.club_info.club_name}
              year={data.club_info.academic_year}
              current={page}
              onNavigate={setPage}
            />
          </div>
          <HomeBoard
            upcoming={board.upcoming}
            thisWeek={board.thisWeek}
            nextWeek={board.nextWeek}
            weekStart={board.weekStart}
            weekEnd={board.weekEnd}
            nextStart={board.nextStart}
            nextEnd={board.nextEnd}
            done={done}
            onToggle={toggle}
            clock={clock}
          />
        </div>
      ) : (
        <div className="flex min-h-screen lg:h-screen lg:flex-row lg:overflow-hidden">
          <Sidebar
            clubName={data.club_info.club_name}
            year={data.club_info.academic_year}
            current={page}
            onNavigate={setPage}
            rail
          />
          <YearCalendar data={data} clock={clock} />
        </div>
      )}
    </div>
  );
}
