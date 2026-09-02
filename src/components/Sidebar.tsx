import { CalendarBlank, House, Wallet } from "@phosphor-icons/react";

const NAV = [
  { id: "home", label: "홈", icon: House, current: true },
  { id: "year", label: "연간 일정", icon: CalendarBlank, current: false },
  { id: "finance", label: "회계", icon: Wallet, current: false },
] as const;

type SidebarProps = {
  clubName: string;
  year: number;
};

export function Sidebar({ clubName, year }: SidebarProps) {
  return (
    <aside className="flex flex-col border-b border-line bg-surface lg:h-full lg:border-r lg:border-b-0">
      <div className="border-b border-line px-5 py-4 lg:py-5">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">UniClub</p>
        <p className="mt-1 text-[13px] text-muted">
          {clubName} · {year}
        </p>
      </div>
      <nav className="flex flex-row gap-1 p-2 lg:flex-1 lg:flex-col lg:p-3" aria-label="임원 메뉴">
        {NAV.map((item) => {
          const Icon = item.icon;
          const className = item.current
            ? "flex items-center gap-2.5 rounded-[6px] bg-canvas px-3 py-2.5 text-[14px] font-medium text-ink"
            : "flex cursor-default items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-[14px] text-muted";
          if (item.current) {
            return (
              <a key={item.id} href="#home" aria-current="page" className={className}>
                <Icon size={18} weight="bold" aria-hidden="true" />
                {item.label}
              </a>
            );
          }
          return (
            <span key={item.id} className={className}>
              <Icon size={18} weight="bold" aria-hidden="true" />
              {item.label}
            </span>
          );
        })}
      </nav>
    </aside>
  );
}
