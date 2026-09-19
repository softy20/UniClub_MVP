/**
 * 모바일 하단 탭 바입니다. 768px 미만에서 사이드바 대신 보여줍니다.
 *
 * @file MobileNav.tsx
 * @module components/MobileNav
 */
import { CalendarBlank, CheckSquare, Lightning, SquaresFour } from "@phosphor-icons/react";
import type { AppPage } from "./Sidebar";

const TABS = [
  { id: "dashboard", label: "대시보드", icon: SquaresFour },
  { id: "calendar", label: "캘린더", icon: CalendarBlank },
  { id: "tasks", label: "할 일", icon: CheckSquare },
  { id: "manual", label: "AI", icon: Lightning },
] as const;

type MobileNavProps = {
  current: AppPage;
  onNavigate: (page: AppPage) => void;
};

export function MobileNav({ current, onNavigate }: MobileNavProps) {
  return (
    <nav
      aria-label="임원 메뉴"
      className="flex shrink-0 border-t border-border bg-card"
      style={{
        height: "calc(64px + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map((item) => {
        const Icon = item.icon;
        const active = item.id === current;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? "page" : undefined}
            className="flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 border-0 bg-transparent"
            style={{
              background: active ? "rgba(0,82,204,0.06)" : "transparent",
            }}
          >
            <Icon size={18} weight="bold" aria-hidden="true" color={active ? "#0052CC" : "var(--fg3)"} />
            <span
              className="text-[10px] leading-none"
              style={{
                fontWeight: active ? 700 : 500,
                color: active ? "#0052CC" : "var(--fg3)",
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
