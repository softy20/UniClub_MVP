import { useEffect, useMemo, useState } from "react";
import { PencilSimple, X } from "@phosphor-icons/react";
import { toDateInputValue } from "../lib/board";
import type { ClubEventPatch } from "../lib/club-store";
import { groupByRole, type OpsEvent } from "../lib/ops";
import { EventCategoryButton, EventDateButton } from "./EventEditors";
import { DdayBadge, RoleChip, Tag } from "./marks";

type EventPanelProps = {
  event: OpsEvent;
  today: Date;
  roster: string[];
  categories: string[];
  onClose: () => void;
  onToggle: (checkId: string) => void;
  onPatch: (eventId: string, patch: ClubEventPatch) => void;
};

export function EventPanel({
  event,
  today,
  roster,
  categories,
  onClose,
  onToggle,
  onPatch,
}: EventPanelProps) {
  const done = event.checklist.filter((item) => item.done).length;
  const total = event.checklist.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const [tab, setTab] = useState<"checklist" | "memo">("checklist");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event.title);
  const [openCat, setOpenCat] = useState(false);
  const month = event.date.getMonth() + 1;
  const day = event.date.getDate();
  const categoryChoices = useMemo(
    () => [...new Set([...categories, event.category, "기타"].map((item) => item.trim()).filter(Boolean))],
    [categories, event.category],
  );
  const roleGroups = useMemo(
    () => groupByRole(event.checklist, roster, (item) => item.role),
    [event.checklist, roster],
  );

  useEffect(() => {
    setTitleDraft(event.title);
    setEditingTitle(false);
    setOpenCat(false);
  }, [event.id]);

  useEffect(() => {
    if (!openCat) return;
    function onPointerDown(pointer: PointerEvent) {
      const target = pointer.target as HTMLElement | null;
      if (target?.closest("[data-cat-dropdown]")) return;
      setOpenCat(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openCat]);

  function saveTitle() {
    const next = titleDraft.trim();
    if (next && next !== event.title) onPatch(event.id, { event_name: next });
    else setTitleDraft(event.title);
    setEditingTitle(false);
  }

  return (
    <div className="slide-in fixed top-0 right-0 z-40 flex h-full w-[400px] flex-col border-l border-border2 bg-card">
      <div className="flex items-start justify-between border-b border-border p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {event.editable ? (
              <EventCategoryButton
                category={event.category}
                choices={categoryChoices}
                open={openCat}
                onToggle={() => setOpenCat((prev) => !prev)}
                onSelect={(label) => {
                  onPatch(event.id, { category: label });
                  setOpenCat(false);
                }}
              />
            ) : (
              <Tag cat={event.category} />
            )}
            <DdayBadge dday={event.dday} />
          </div>
          {event.editable && editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(change) => setTitleDraft(change.target.value)}
              onKeyDown={(key) => {
                if (key.key === "Enter") saveTitle();
                if (key.key === "Escape") {
                  setTitleDraft(event.title);
                  setEditingTitle(false);
                }
              }}
              onBlur={saveTitle}
              className="font-display w-full rounded-md border border-accent bg-bg px-2 py-1 text-lg leading-tight font-bold text-fg outline-none"
              aria-label="행사 제목"
            />
          ) : event.editable ? (
            <button
              type="button"
              aria-label={`${event.title} 수정`}
              onClick={() => {
                setTitleDraft(event.title);
                setEditingTitle(true);
              }}
              className="font-display flex w-full cursor-pointer items-start gap-1.5 rounded-md border border-transparent text-left text-lg leading-tight font-bold text-fg"
            >
              <span className="min-w-0 flex-1">{event.title}</span>
              <PencilSimple size={15} weight="bold" aria-hidden="true" className="mt-1 shrink-0 text-fg3" />
            </button>
          ) : (
            <h2 className="font-display text-lg leading-tight font-bold text-fg">{event.title}</h2>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {event.editable ? (
              <EventDateButton
                value={toDateInputValue(event.date)}
                today={today}
                defaultMonth={event.date.getMonth() + 1}
                onChange={(iso) => onPatch(event.id, { event_date: iso })}
              />
            ) : (
              <p className="text-xs text-fg3">
                {month}월 {day}일
              </p>
            )}
            {event.location ? <p className="text-xs text-fg3">· {event.location}</p> : null}
          </div>
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
          <div className="flex flex-col gap-4">
            <p className="text-[12px] tracking-widest text-fg3 uppercase">부서별 TO-DO</p>
            {event.checklist.length === 0 ? (
              <p className="text-sm text-fg3">이 행사에 적힌 할 일이 없습니다.</p>
            ) : (
              roleGroups.map((group) => {
                const groupDone = group.items.filter((item) => item.done).length;
                return (
                  <section key={group.role}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <RoleChip name={group.role} roster={roster} />
                      <span className="tabular text-[11px] text-fg3">
                        {groupDone}/{group.items.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.items.map((item) => (
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
                            <span className={`text-sm text-fg ${item.done ? "line-through opacity-40" : ""}`}>
                              {item.text}
                            </span>
                            <p className="mt-0.5 text-[12px] text-fg3">D-Day {item.daysBefore}일 전</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })
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
