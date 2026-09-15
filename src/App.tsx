import { useMemo, useState } from "react";
import club from "./data/club.json";
import { AiParsePage } from "./components/AiParsePage";
import { DashboardPage } from "./components/DashboardPage";
import { EventPanel } from "./components/EventPanel";
import { MakeCalendar } from "./components/MakeCalendar";
import { PAGE_LABEL, Sidebar, type AppPage } from "./components/Sidebar";
import { TasksPage } from "./components/TasksPage";
import { loadDoneIds, saveDoneIds } from "./lib/board";
import { loadClubData, patchClubEvent, saveClubData, type ClubEventPatch } from "./lib/club-store";
import { useKstNow } from "./lib/kst";
import { buildOpsEvents, uniqueCategoryLabels } from "./lib/ops";
import type { ClubData } from "./lib/types";

const seed = club as ClubData;

export default function App() {
  const clock = useKstNow();
  const [page, setPage] = useState<AppPage>("dashboard");
  const [data, setData] = useState<ClubData>(() => loadClubData(seed));
  const [done, setDone] = useState<Set<string>>(() => loadDoneIds());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const events = useMemo(
    () => buildOpsEvents(data, clock.civil, done),
    [data, clock.year, clock.month, clock.day, done],
  );
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const totalTasks = events.reduce((sum, event) => sum + event.checklist.length, 0);
  const totalDone = events.reduce((sum, event) => sum + event.checklist.filter((item) => item.done).length, 0);
  const overallPct = totalTasks === 0 ? 0 : Math.round((totalDone / totalTasks) * 100);

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveDoneIds(next);
      return next;
    });
  }

  function go(next: AppPage) {
    setPage(next);
    setSelectedId(null);
  }

  function persist(next: ClubData) {
    try {
      saveClubData(next);
    } catch (error) {
      console.error("클럽 데이터 저장 실패", error);
    }
    setData(next);
  }

  function applyClubData(next: ClubData) {
    persist(next);
    go("calendar");
  }

  function patchEvent(eventId: string, patch: ClubEventPatch) {
    setData((prev) => {
      const next = patchClubEvent(prev, eventId, patch);
      try {
        saveClubData(next);
      } catch (error) {
        console.error("클럽 데이터 저장 실패", error);
      }
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        current={page}
        onNavigate={go}
        events={events}
        clubName={data.club_info.club_name}
        overallPct={overallPct}
      />

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-bg2 px-6 py-4">
          <div>
            <h1 className="font-display text-lg font-bold text-fg">{PAGE_LABEL[page]}</h1>
            <p className="mt-0.5 text-[12px] text-fg3">
              {data.club_info.academic_year}년 · {data.club_info.club_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-[29px] items-center gap-1.5 rounded-md bg-card px-2.5">
              <span className="pulse-dot size-[7px] shrink-0 rounded-full bg-green-500" />
              <span className="tabular text-[13px] font-semibold text-fg3">
                오늘 {clock.month}월 {clock.day}일
              </span>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {page === "dashboard" ? (
            <DashboardPage
              events={events}
              officerCount={data.club_info.roles.length}
              onSelect={(event) => setSelectedId(event.id)}
            />
          ) : null}
          {page === "calendar" ? (
            <MakeCalendar
              key={`${data.club_info.club_name}-${data.club_info.academic_year}-${data.events.length}`}
              events={events}
              clock={clock}
              focusEvent={selected}
              onSelect={(event) => setSelectedId(event.id)}
            />
          ) : null}
          {page === "tasks" ? (
            <TasksPage
              events={events}
              roster={data.club_info.roles.map((role) => role.role_name)}
              onToggle={toggle}
            />
          ) : null}
          {page === "manual" ? <AiParsePage onApply={applyClubData} /> : null}
        </div>
      </main>

      {selected ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default bg-black/50"
            aria-label="패널 닫기"
            onClick={() => setSelectedId(null)}
          />
          <EventPanel
            event={selected}
            today={clock.civil}
            roster={data.club_info.roles.map((role) => role.role_name)}
            categories={uniqueCategoryLabels(data.events)}
            onClose={() => setSelectedId(null)}
            onToggle={toggle}
            onPatch={patchEvent}
          />
        </>
      ) : null}
    </div>
  );
}
