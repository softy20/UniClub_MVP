import { CalendarBlank, CheckSquare, Lightning, SquaresFour } from "@phosphor-icons/react";
import { CATS, type FigmaCat, type OpsEvent } from "../lib/ops";

export type AppPage = "dashboard" | "calendar" | "tasks" | "manual";

const NAV = [
  { id: "dashboard", label: "대시보드", icon: SquaresFour },
  { id: "calendar", label: "캘린더", icon: CalendarBlank },
  { id: "tasks", label: "할 일 목록", icon: CheckSquare },
  { id: "manual", label: "AI 파싱", icon: Lightning },
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
    {} as Partial<Record<FigmaCat, number>>,
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
            {(Object.entries(CATS) as [string, (typeof CATS)[FigmaCat]][]).map(([key, item]) => {
              const cat = Number(key) as FigmaCat;
              const count = counts[cat] ?? 0;
              if (count === 0) return null;
              return (
                <div key={key} className="flex items-center gap-2 px-3 py-1.5">
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
  manual: "AI 파싱",
};
