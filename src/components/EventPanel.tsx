import { useState } from "react";
import { X } from "@phosphor-icons/react";
import type { OpsEvent } from "../lib/ops";
import { DdayBadge, Tag } from "./marks";

type EventPanelProps = {
  event: OpsEvent;
  onClose: () => void;
  onToggle: (checkId: string) => void;
};

export function EventPanel({ event, onClose, onToggle }: EventPanelProps) {
  const done = event.checklist.filter((item) => item.done).length;
  const total = event.checklist.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const [tab, setTab] = useState<"checklist" | "memo">("checklist");
  const month = event.date.getMonth() + 1;
  const day = event.date.getDate();

  return (
    <div className="slide-in fixed top-0 right-0 z-40 flex h-full w-[400px] flex-col border-l border-border2 bg-card">
      <div className="flex items-start justify-between border-b border-border p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Tag cat={event.category} />
            <DdayBadge dday={event.dday} />
          </div>
          <h2 className="font-display text-lg leading-tight font-bold text-fg">{event.title}</h2>
          <p className="mt-1.5 text-xs text-fg3">
            {month}월 {day}일
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded text-fg3"
          aria-label="닫기"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="border-b border-border px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-fg3">준비 진행률</span>
          <span className="text-xs font-bold" style={{ color: pct === 100 ? "#22c55e" : "var(--accent2)" }}>
            {done}/{total} · {pct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "var(--accent)" }}
          />
        </div>
      </div>

      <div className="flex border-b border-border">
        {(["checklist", "memo"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className="flex-1 cursor-pointer py-2.5 text-xs font-medium"
            style={{
              color: tab === item ? "var(--fg)" : "var(--fg3)",
              borderBottom: tab === item ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {item === "checklist" ? "체크리스트" : "메모"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "checklist" ? (
          <div className="flex flex-col gap-2">
            <p className="mb-3 text-[12px] tracking-widest text-fg3 uppercase">D-Day 역산 체크리스트</p>
            {event.checklist.length === 0 ? (
              <p className="text-sm text-fg3">이 행사에 적힌 할 일이 없습니다.</p>
            ) : (
              event.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg p-3"
                  style={{ background: item.done ? "rgba(34,197,94,0.06)" : "var(--card2)" }}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => onToggle(item.id)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm text-fg ${item.done ? "line-through opacity-40" : ""}`}>{item.text}</span>
                    <p className="mt-0.5 text-[12px] text-fg3">D-Day {item.daysBefore}일 전</p>
                  </div>
                </label>
              ))
            )}
          </div>
        ) : (
          <div>
            <p className="mb-3 text-[12px] tracking-widest text-fg3 uppercase">운영 메모</p>
            <div className="rounded-lg bg-card2 p-4 text-sm leading-relaxed text-fg2 whitespace-pre-wrap">
              {event.memo || "메모가 없습니다."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
