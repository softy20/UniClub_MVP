/**
 * 🧭 UniClub - Sidebar (왼쪽 메뉴 바)
 *
 * 화면 왼쪽에 항상 붙어 있는 메뉴 바입니다. 대시보드, 캘린더, 할 일 목록, AI 일정 추출
 * 화면으로 이동하는 버튼과, 전체 진행률, 카테고리별 행사 개수를 보여줍니다.
 *
 * 📌 주요 기능:
 * - 4개의 메뉴(대시보드/캘린더/할 일 목록/AI 일정 추출) 버튼을 보여주고 현재 위치를 표시합니다.
 * - 2학기 전체 진행률을 막대 그래프로 보여줍니다.
 * - 행사 분류(카테고리)별로 몇 개의 행사가 있는지 세어서 목록으로 보여줍니다.
 * - 동아리 이름의 첫 글자를 아이콘처럼 보여주고, 동아리 이름을 하단에 표시합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * import { Sidebar } from "./components/Sidebar";
 * <Sidebar
 *   current="calendar"
 *   onNavigate={(page) => setCurrentPage(page)}
 *   events={events}
 *   clubName="ABC 동아리"
 *   overallPct={72}
 * />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 타입: AppPage(현재 화면을 나타내는 값: "dashboard" | "calendar" | "tasks" | "manual")
 * - export되는 상수: PAGE_LABEL(각 화면 값에 대응하는 한글 이름)
 * - 외부에서 전달받는 데이터(Props): current(현재 보고 있는 화면), onNavigate(메뉴를 눌렀을 때
 *   실행할 함수), events(행사 목록, 카테고리 개수를 세는 데 사용), clubName(동아리 이름),
 *   overallPct(전체 진행률 퍼센트)
 * - 이 컴포넌트는 자기 안에 따로 바뀌는 데이터(State)가 없습니다. 모든 값은 Props로 받습니다.
 * - 의존성: ../lib/ops(카테고리 스타일과 분류 목록을 가져오는 함수)
 *
 * 💡 팁 및 주의사항:
 * - 카테고리 목록 중 행사 개수가 0개인 분류는 화면에 표시되지 않습니다.
 * - 메뉴 항목(NAV)은 이 파일 위쪽에 고정된 배열로 정의되어 있어서, 메뉴를 추가/삭제하려면
 *   그 배열과 AppPage 타입, PAGE_LABEL을 함께 맞춰줘야 합니다.
 *
 * @file Sidebar.tsx
 * @module components/Sidebar
 */
import { CalendarBlank, CheckSquare, Lightning, SquaresFour } from "@phosphor-icons/react";
import { categoryStyle, uniqueCategoryLabels, type OpsEvent } from "../lib/ops";

export type AppPage = "dashboard" | "calendar" | "tasks" | "manual";

const NAV = [
  { id: "dashboard", label: "대시보드", icon: SquaresFour },
  { id: "calendar", label: "캘린더", icon: CalendarBlank },
  { id: "tasks", label: "할 일 목록", icon: CheckSquare },
  { id: "manual", label: "AI 일정 추출", icon: Lightning },
] as const;

type SidebarProps = {
  current: AppPage;
  onNavigate: (page: AppPage) => void;
  events: OpsEvent[];
  clubName: string;
  overallPct: number;
};

export function Sidebar({ current, onNavigate, events, clubName, overallPct }: SidebarProps) {
  const counts = events.reduce(
    (acc, event) => {
      acc[event.category] = (acc[event.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-5 py-5">
        <div className="mb-1 flex items-center gap-2.5">
          <div
            className="font-display flex size-7 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            U
          </div>
          <div>
            <p className="font-display text-sm font-bold text-fg">UniClub</p>
            <p className="text-[11px] text-fg3">MVP v0.1</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-card px-2 py-1.5">
          <p className="mb-1 text-[13px] text-fg3">2학기 전체 진행률</p>
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-border2">
              <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${overallPct}%` }} />
            </div>
            <span className="text-[12px] font-bold text-accent2">{overallPct}%</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="임원 메뉴">
        <p className="mb-2 px-2 text-[12px] tracking-widest text-fg3 uppercase">메뉴</p>
        <div className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === current;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                className="font-display flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium"
                style={{
                  background: active ? "var(--color-nav-active)" : "transparent",
                  color: active ? "var(--accent2)" : "var(--fg3)",
                  border: active ? "1px solid var(--color-nav-line)" : "1px solid transparent",
                }}
              >
                <Icon size={18} weight="bold" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <p className="mb-2 px-2 text-[12px] tracking-widest text-fg3 uppercase">카테고리</p>
          <div className="flex flex-col gap-0.5">
            {uniqueCategoryLabels(events).map((cat) => {
              const item = categoryStyle(cat);
              const count = counts[cat] ?? 0;
              if (count === 0) return null;
              return (
                <div key={cat} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-display flex-1 text-xs text-fg3">{item.label}</span>
                  <span className="text-[12px] text-fg3">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="font-display flex size-8 items-center justify-center rounded-full bg-[#6366f1] text-sm font-bold text-white">
            {clubName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="font-display text-xs font-medium text-fg">{clubName}</p>
            <p className="text-[12px] text-fg3">임원 보드</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export const PAGE_LABEL: Record<AppPage, string> = {
  dashboard: "대시보드",
  calendar: "캘린더",
  tasks: "할 일 목록",
  manual: "AI 일정 추출",
};
