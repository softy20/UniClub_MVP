import { useState } from "react";
import { CalendarBlank, House, List, Wallet } from "@phosphor-icons/react";

export type AppPage = "home" | "year";

const NAV = [
  { id: "home", label: "홈", icon: House, enabled: true },
  { id: "year", label: "연간 일정", icon: CalendarBlank, enabled: true },
  { id: "finance", label: "회계", icon: Wallet, enabled: false },
] as const;

type SidebarProps = {
  clubName: string;
  year: number;
  current: AppPage;
  onNavigate: (page: AppPage) => void;
  rail?: boolean;
};

export function Sidebar({ clubName, year, current, onNavigate, rail = false }: SidebarProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = !rail || pinned || hovered;

  return (
    <div className={rail ? "relative z-30 w-14 shrink-0 self-stretch lg:h-full lg:w-[232px]" : "lg:row-span-2 lg:min-h-screen"}>
      <aside
        className={
          rail
            ? `absolute inset-y-0 left-0 z-30 flex h-full flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:static lg:w-[232px] ${
                expanded ? "w-[232px]" : "w-14"
              }`
            : "flex flex-col border-b border-line bg-surface lg:h-full lg:border-r lg:border-b-0"
        }
        onMouseEnter={() => {
          if (rail) setHovered(true);
        }}
        onMouseLeave={() => {
          if (rail) setHovered(false);
        }}
      >
        <div className={`border-b border-line ${rail ? "px-2 py-3 lg:px-5 lg:py-5" : "px-5 py-4 lg:py-5"}`}>
          <div className="flex items-center gap-2">
            {rail ? (
              <button
                type="button"
                aria-label="메뉴"
                aria-expanded={expanded}
                onClick={() => setPinned((value) => !value)}
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-ink transition-colors duration-150 hover:bg-[#e6f5f5] lg:hidden"
              >
                <List size={18} weight="bold" aria-hidden="true" />
              </button>
            ) : null}
            <div className={expanded ? "min-w-0" : "hidden min-w-0 lg:block"}>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">UniClub</p>
              <p className="mt-1 text-[13px] text-muted">
                {clubName} · {year}
              </p>
            </div>
          </div>
        </div>
        <nav
          className={
            rail
              ? "flex flex-1 flex-col gap-1 p-2 lg:p-3"
              : "flex flex-row gap-1 p-2 lg:flex-1 lg:flex-col lg:p-3"
          }
          aria-label="임원 메뉴"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const isCurrent = item.enabled && item.id === current;
            const className = isCurrent
              ? "flex cursor-pointer items-center gap-2.5 rounded-[6px] bg-canvas px-3 py-2.5 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-[#e6f5f5]"
              : "flex cursor-pointer items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-[14px] text-muted transition-colors duration-150 hover:bg-[#e6f5f5]";
            const label = <span className={expanded ? "truncate" : "hidden lg:inline"}>{item.label}</span>;
            if (!item.enabled) {
              return (
                <span key={item.id} className={`${className} cursor-default hover:bg-transparent ${rail && !expanded ? "lg:gap-2.5 max-lg:justify-center max-lg:px-0" : ""}`}>
                  <Icon size={18} weight="bold" aria-hidden="true" />
                  {label}
                </span>
              );
            }
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={isCurrent ? "page" : undefined}
                className={`${className} cursor-pointer ${rail && !expanded ? "max-lg:justify-center max-lg:px-0" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.id);
                }}
              >
                <Icon size={18} weight="bold" aria-hidden="true" />
                {label}
              </a>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
