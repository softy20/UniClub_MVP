import { useState } from "react";
import { ALL_CATS, type FigmaCat, type OpsEvent } from "../lib/ops";
import { CategoryFilter, Tag } from "./marks";

type TasksPageProps = {
  events: OpsEvent[];
  onToggle: (checkId: string) => void;
};

export function TasksPage({ events, onToggle }: TasksPageProps) {
  const [showDone, setShowDone] = useState(false);
  const [active, setActive] = useState<Set<FigmaCat>>(new Set(ALL_CATS));

  const tasks = events
    .flatMap((event) =>
      event.checklist.map((item) => ({
        ...item,
        eventTitle: event.title,
        category: event.category,
        daysLeft: event.daysLeft,
      })),
    )
    .filter((task) => (showDone || !task.done) && active.has(task.category))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] tracking-widest text-fg3 uppercase">
          할 일 목록 · {tasks.length}개 {showDone ? "" : "미완료"}
        </p>
        <button
          type="button"
          onClick={() => setShowDone((value) => !value)}
          className="cursor-pointer rounded px-3 py-1.5 text-xs"
          style={{
            background: showDone ? "var(--accent)" : "var(--card)",
            color: showDone ? "#fff" : "var(--fg3)",
            border: "1px solid var(--border)",
          }}
        >
          완료 {showDone ? "숨기기" : "보기"}
        </button>
      </div>
      <div className="mb-5">
        <CategoryFilter
          active={active}
          onToggle={(cat) => {
            setActive((prev) => {
              const next = new Set(prev);
              if (next.has(cat)) next.delete(cat);
              else next.add(cat);
              return next;
            });
          }}
          onToggleAll={() =>
            setActive((prev) => (prev.size === ALL_CATS.length ? new Set() : new Set(ALL_CATS)))
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <label
            key={task.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 hover:opacity-90"
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => onToggle(task.id)}
              className="size-4 shrink-0 cursor-pointer accent-indigo-500"
            />
            <div className="min-w-0 flex-1">
              <p className={`font-display text-sm text-fg ${task.done ? "line-through opacity-40" : ""}`}>{task.text}</p>
              <div className="mt-1 flex items-center gap-2">
                <Tag cat={task.category} />
                <span className="text-[12px] text-fg3">{task.eventTitle}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] text-fg3">D-Day</p>
              <p className="text-xs font-bold" style={{ color: task.daysBefore <= 3 ? "#ef4444" : "var(--accent2)" }}>
                {task.daysBefore}일 전
              </p>
            </div>
          </label>
        ))}
        {tasks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display font-semibold text-fg3">표시할 할 일이 없습니다.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
