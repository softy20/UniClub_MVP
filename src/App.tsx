/**
 * 🧭 UniClub - App
 *
 * 로그인 후 보이는 메인 화면입니다. 왼쪽 사이드바와 오른쪽 본문 영역을 조합해서
 * 대시보드, 달력, 할 일, AI 입력 페이지를 전환해서 보여주는 역할을 합니다.
 *
 * 📌 주요 기능:
 * - 사이드바 메뉴를 눌러 대시보드/달력/할 일/AI 입력 페이지 사이를 이동합니다.
 * - 동아리 데이터(useClubData)를 불러오고, 수정된 내용을 저장합니다.
 * - 행사와 할 일 목록을 계산해서 각 페이지 컴포넌트에 전달합니다.
 * - 할 일 완료 체크(toggle)와 완료 상태를 브라우저에 저장(saveDoneIds)합니다.
 * - 특정 행사를 클릭하면 오른쪽에서 상세 패널(EventPanel)을 열어줍니다.
 * - "오늘" 버튼을 누르면 오늘 날짜가 보이는 달력으로 바로 이동합니다.
 * - 로그아웃 버튼을 누르면 상위(main.tsx)에서 받은 onSignOut 함수를 실행합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * // main.tsx에서 로그인이 확인된 뒤 이렇게 사용합니다
 * <App onSignOut={signOut} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - Props onSignOut: 로그아웃 버튼을 눌렀을 때 실행할 함수
 * - State page: 지금 보고 있는 페이지 (dashboard/calendar/tasks/manual)
 * - State done: 완료 처리한 할 일 목록
 * - State selectedId: 상세 패널로 열어본 행사의 아이디
 * - State goToday: "오늘" 버튼을 눌렀는지 여부 (달력 이동용)
 * - 화면 조합: Sidebar, DashboardPage, MakeCalendar, TasksPage, AiParsePage, EventPanel
 *
 * 💡 팁 및 주의사항:
 * - events, totalTasks, overallPct 같은 값은 매번 새로 계산하지 않고
 *   useMemo로 필요할 때만 다시 계산해서 성능을 아낍니다.
 * - 페이지 이동(go)을 할 때마다 열려 있던 상세 패널은 자동으로 닫힙니다.
 * - 할 일을 삭제하면(patchEventAndSync) 완료 체크 목록에서도 같이 지워줘서
 *   데이터가 서로 어긋나지 않게 합니다.
 *
 * @file App.tsx
 * @module App
 */
import { useMemo, useState } from "react";
import club from "./data/club.json";
import { AiParsePage } from "./components/AiParsePage";
import { DashboardPage } from "./components/DashboardPage";
import { EventPanel } from "./components/EventPanel";
import { MakeCalendar } from "./components/MakeCalendar";
import { PAGE_LABEL, Sidebar, type AppPage } from "./components/Sidebar";
import { TasksPage } from "./components/TasksPage";
import { loadDoneIds, saveDoneIds } from "./lib/board";
import type { ClubEventPatch } from "./lib/club-store";
import { useKstNow } from "./lib/kst";
import { buildOpsEvents, uniqueCategoryLabels } from "./lib/ops";
import { useClubData } from "./hooks/useClubData";
import type { ClubData } from "./lib/types";

const seed = club as ClubData;

type AppProps = {
  onSignOut: () => void;
};

export default function App({ onSignOut }: AppProps) {
  const clock = useKstNow();
  const [page, setPage] = useState<AppPage>("dashboard");
  const { data, applyClubData, patchEvent } = useClubData(seed);
  const [done, setDone] = useState<Set<string>>(() => loadDoneIds());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goToday, setGoToday] = useState(false);

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

  function goTodayCalendar() {
    setSelectedId(null);
    setPage("calendar");
    setGoToday(true);
  }

  function applyClubDataAndNavigate(next: ClubData) {
    applyClubData(next);
    go("calendar");
  }

  function patchEventAndSync(eventId: string, patch: ClubEventPatch) {
    if (patch.task?.remove) {
      setDone((prev) => {
        if (!prev.has(patch.task!.id)) return prev;
        const next = new Set(prev);
        next.delete(patch.task!.id);
        saveDoneIds(next);
        return next;
      });
    }
    patchEvent(eventId, patch);
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
            <button
              type="button"
              onClick={goTodayCalendar}
              aria-label="오늘이 있는 달력으로 이동"
              className="flex h-[29px] cursor-pointer items-center gap-1.5 rounded-md bg-card px-2.5 transition-colors duration-150 hover:bg-card2"
            >
              <span className="pulse-dot size-[7px] shrink-0 rounded-full bg-green-500" />
              <span className="tabular text-[13px] font-semibold text-fg3">
                오늘 {clock.month}월 {clock.day}일
              </span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-[29px] cursor-pointer items-center rounded-md bg-card px-2.5 text-[13px] font-semibold text-fg3 transition-colors duration-150 hover:bg-card2"
            >
              로그아웃
            </button>
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
              focusToday={goToday}
              onTodayFocused={() => setGoToday(false)}
              onSelect={(event) => setSelectedId(event.id)}
            />
          ) : null}
          {page === "tasks" ? (
            <TasksPage
              events={events}
              roster={data.club_info.roles.map((role) => role.role_name)}
              onToggle={toggle}
              onPatch={patchEventAndSync}
            />
          ) : null}
          {page === "manual" ? <AiParsePage onApply={applyClubDataAndNavigate} /> : null}
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
            onPatch={patchEventAndSync}
          />
        </>
      ) : null}
    </div>
  );
}
