import { ALL_CATS, CATS, type FigmaCat } from "../lib/ops";

export function Tag({ cat }: { cat: FigmaCat }) {
  const item = CATS[cat];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[13px] font-semibold"
      style={{ color: item.color, background: item.bg }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
      {item.label}
    </span>
  );
}

export function DdayBadge({ dday }: { dday: string }) {
  const past = dday.startsWith("D+");
  const num = past ? Number.POSITIVE_INFINITY : Number(dday.replace("D-", ""));
  const dot = past ? "#94a3b8" : num <= 1 ? "#ef4444" : num <= 7 ? "#eab308" : "#22c55e";
  return (
    <span className="inline-flex items-center gap-[5px] text-[13px] font-semibold text-[#888]">
      <span className="size-[7px] shrink-0 rounded-full" style={{ background: dot }} />
      {dday}
    </span>
  );
}

export const ROLE_COLORS = ["#0066FF", "#E8492C", "#00838F", "#6A4FE0", "#D81B7A", "#8E24AA"] as const;

export function roleAccent(name: string, roster: string[] = []): string {
  const indexed = roster.indexOf(name);
  if (indexed >= 0) return ROLE_COLORS[indexed % ROLE_COLORS.length];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ROLE_COLORS[Math.abs(hash) % ROLE_COLORS.length];
}

export function RoleChip({
  name,
  roster,
  onClick,
}: {
  name: string;
  roster?: string[];
  onClick?: () => void;
}) {
  const color = roleAccent(name, roster);
  const className =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-[5px] text-[13px] font-semibold";
  const style = {
    background: `${color}15`,
    color,
    border: `1px solid ${color}40`,
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} cursor-pointer`} style={style}>
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
        {name}
      </button>
    );
  }

  return (
    <span className={className} style={style}>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

export function DminusBadge({ daysLeft }: { daysLeft: number }) {
  const past = daysLeft < 0;
  const urgent = !past && daysLeft <= 7;
  const soon = !past && daysLeft <= 14;
  const color = past ? "#94a3b8" : urgent ? "#ef4444" : soon ? "#eab308" : "#0066FF";
  const dot = past ? "#94a3b8" : urgent ? "#ef4444" : soon ? "#eab308" : "#22c55e";
  const label = daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? "D-0" : `D+${-daysLeft}`;
  return (
    <span className="inline-flex shrink-0 items-center gap-[5px] text-[13px] font-bold" style={{ color }}>
      <span className="size-[7px] shrink-0 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

type FilterProps = {
  active: Set<FigmaCat>;
  onToggle: (cat: FigmaCat) => void;
  onToggleAll: () => void;
};

export function CategoryFilter({ active, onToggle, onToggleAll }: FilterProps) {
  const allOn = active.size === ALL_CATS.length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleAll}
        className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[10px] border-0 px-3.5 text-[13px] font-medium"
        style={{
          background: allOn ? "rgba(55,56,60,0.1)" : "var(--card)",
          color: allOn ? "var(--fg)" : "var(--fg3)",
        }}
      >
        <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: allOn ? "var(--fg)" : "var(--fg3)" }} />
        전체
      </button>
      {ALL_CATS.map((cat) => {
        const item = CATS[cat];
        const on = active.has(cat);
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onToggle(cat)}
            className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[10px] border-0 px-3.5 text-[13px] font-medium"
            style={{
              background: on ? item.bg : "var(--card)",
              color: on ? item.color : "var(--fg3)",
            }}
          >
            <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: on ? item.color : "var(--fg3)" }} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
