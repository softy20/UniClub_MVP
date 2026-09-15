import { categoryStyle, uniqueCategoryLabels, type OpsEvent } from "../lib/ops";

function ChipRemoveButton({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      className="ml-0.5 cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-none opacity-70"
      style={{ color }}
      aria-label={`${label} 삭제`}
    >
      ×
    </button>
  );
}

export function Tag({
  cat,
  onClick,
  onRemove,
}: {
  cat: string;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  const item = categoryStyle(cat);
  const className = "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[13px] font-semibold";
  const style = { color: item.color, background: item.bg };
  const dot = <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />;

  if (onRemove || onClick) {
    return (
      <span className={className} style={style}>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-semibold"
            style={{ color: item.color }}
          >
            {dot}
            {item.label}
          </button>
        ) : (
          <>
            {dot}
            {item.label}
          </>
        )}
        {onRemove ? <ChipRemoveButton label={item.label} color={item.color} onRemove={onRemove} /> : null}
      </span>
    );
  }

  return (
    <span className={className} style={style}>
      {dot}
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
  accentName,
  asButton,
  onClick,
  onRemove,
}: {
  name: string;
  roster?: string[];
  accentName?: string;
  asButton?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  const color = roleAccent(accentName ?? name, roster);
  const className =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-[5px] text-[13px] font-semibold";
  const style = {
    background: `${color}15`,
    color,
    border: `1px solid ${color}40`,
  };
  const dot = <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />;
  const remove = onRemove ? <ChipRemoveButton label={name} color={color} onRemove={onRemove} /> : null;

  if (onRemove) {
    return (
      <span className={className} style={style}>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-semibold"
            style={{ color }}
          >
            {dot}
            {name}
          </button>
        ) : (
          <>
            {dot}
            {name}
          </>
        )}
        {remove}
      </span>
    );
  }

  if (onClick || asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} ${onClick ? "cursor-pointer" : "cursor-default"}`}
        style={style}
      >
        {dot}
        {name}
      </button>
    );
  }

  return (
    <span className={className} style={style}>
      {dot}
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
  events: OpsEvent[];
  active: Set<string>;
  onToggle: (cat: string) => void;
  onToggleAll: () => void;
};

export function CategoryFilter({ events, active, onToggle, onToggleAll }: FilterProps) {
  const categories = uniqueCategoryLabels(events);
  const allOn = categories.length > 0 && categories.every((cat) => active.has(cat));
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
      {categories.map((cat) => {
        const item = categoryStyle(cat);
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
