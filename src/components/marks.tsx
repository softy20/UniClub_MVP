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
