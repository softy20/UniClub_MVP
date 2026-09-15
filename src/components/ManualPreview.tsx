import { PencilSimple } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { dayDiff } from "../lib/board";
import { readKst } from "../lib/kst";
import { isInferredTask, type ClubData, type ClubEvent, type ClubTask } from "../lib/types";
import { groupByRole, uniqueCategoryLabels } from "../lib/ops";
import { dateFromIso, EventCategoryButton, EventDateButton, isoDateParts } from "./EventEditors";
import { DminusBadge, RoleChip } from "./marks";

export type AcademicTerm = "winter" | "spring" | "summer" | "fall" | "all";

const SEMESTER_TABS: {
  id: AcademicTerm;
  label: string;
  sub: string;
  tooltip: string;
}[] = [
  { id: "winter", label: "동계방학", sub: "12–2월", tooltip: "인수인계 · 동계 MT · 신임 임원 모집 · 봄 모집 준비" },
  { id: "spring", label: "1학기", sub: "3–5월", tooltip: "봄 신입 모집 · OT · 정기 총회" },
  { id: "summer", label: "하계방학", sub: "6–8월", tooltip: "여름 MT · 봉사활동 · 여름 워크숍" },
  { id: "fall", label: "2학기", sub: "9–11월", tooltip: "가을 신입 모집 · 정기공연 · 졸업 축하" },
  { id: "all", label: "전체 행사", sub: "", tooltip: "" },
];

type ManualPreviewProps = {
  data: ClubData;
  categoryOptions?: string[];
  onChange: (next: ClubData) => void;
  onApply: (next: ClubData) => void;
  onBack?: () => void;
  onReset?: () => void;
};

type EditingTask = { eventId: string; taskKey: string; text: string };

const COMMON_ROLE = "공통";

function termForMonth(month: number): Exclude<AcademicTerm, "all"> {
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

function taskKey(eventId: string, task: ClubTask, index: number): string {
  return task.task_id ?? `${eventId}-${index}`;
}

function newTaskId(): string {
  return `draft-${crypto.randomUUID()}`;
}

function updateEvent(data: ClubData, eventId: string, updater: (event: ClubEvent) => ClubEvent): ClubData {
  return {
    ...data,
    events: data.events.map((event) => (event.event_id === eventId ? updater(event) : event)),
  };
}

function defaultRole(data: ClubData): string {
  return data.club_info.roles[0]?.role_name ?? COMMON_ROLE;
}

export function ManualPreview({ data, categoryOptions, onChange, onApply, onBack, onReset }: ManualPreviewProps) {
  const [term, setTerm] = useState<AcademicTerm>("all");
  const [tooltipTab, setTooltipTab] = useState<AcademicTerm | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EditingTask | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventNameDraft, setEventNameDraft] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [openCatId, setOpenCatId] = useState<string | null>(null);
  const today = useMemo(() => readKst().civil, []);

  useEffect(() => {
    if (!openCatId) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-cat-dropdown]")) return;
      setOpenCatId(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openCatId]);
  const roster = data.club_info.roles.map((role) => role.role_name);
  const totalTasks = data.events.reduce((sum, event) => sum + event.tasks.length, 0);
  const inferredCount = data.events.reduce(
    (sum, event) => sum + event.tasks.filter(isInferredTask).length,
    0,
  );

  const visible = data.events.filter((event) => term === "all" || termForMonth(event.target_month) === term);

  function toggleDone(key: string) {
    setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function saveEdit() {
    if (!editing) return;
    const nextName = editing.text.trim();
    if (!nextName) return;
    onChange(
      updateEvent(data, editing.eventId, (event) => ({
        ...event,
        tasks: event.tasks.map((task, index) =>
          taskKey(event.event_id, task, index) === editing.taskKey ? { ...task, task_name: nextName } : task,
        ),
      })),
    );
    setEditing(null);
  }

  function removeTask(eventId: string, key: string) {
    onChange(
      updateEvent(data, eventId, (event) => ({
        ...event,
        tasks: event.tasks.filter((task, index) => taskKey(event.event_id, task, index) !== key),
      })),
    );
    setDone((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (editing?.taskKey === key) setEditing(null);
  }

  function addTask(eventId: string) {
    const text = draftText.trim();
    if (!text) return;
    onChange(
      updateEvent(data, eventId, (event) => ({
        ...event,
        tasks: [
          ...event.tasks,
          {
            task_id: newTaskId(),
            task_name: text,
            days_before_dday: 7,
            assigned_role: defaultRole(data),
            is_mandatory: false,
          },
        ],
      })),
    );
    setDraftText("");
    setAddingTo(null);
  }

  function setEventDate(eventId: string, value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const month = Number(value.slice(5, 7));
    const nextMonth = month >= 1 && month <= 12 ? month : null;
    onChange(
      updateEvent(data, eventId, (event) => ({
        ...event,
        event_date: value,
        target_month: nextMonth ?? event.target_month,
      })),
    );
    if (nextMonth && term !== "all" && termForMonth(nextMonth) !== term) {
      setTerm(termForMonth(nextMonth));
    }
  }

  function setEventCategory(eventId: string, category: string) {
    const next = category.trim();
    if (!next) return;
    onChange(updateEvent(data, eventId, (event) => ({ ...event, category: next })));
  }

  function saveEventName() {
    if (!editingEventId) return;
    const nextName = eventNameDraft.trim();
    if (nextName) {
      onChange(updateEvent(data, editingEventId, (event) => ({ ...event, event_name: nextName })));
    }
    setEditingEventId(null);
  }

  function removeEvent(eventId: string) {
    const target = data.events.find((event) => event.event_id === eventId);
    onChange({
      ...data,
      events: data.events.filter((event) => event.event_id !== eventId),
    });
    setDone((prev) => {
      const next = { ...prev };
      target?.tasks.forEach((task, index) => {
        delete next[taskKey(eventId, task, index)];
      });
      return next;
    });
    if (editing?.eventId === eventId) setEditing(null);
    if (editingEventId === eventId) setEditingEventId(null);
    if (openCatId === eventId) setOpenCatId(null);
    if (addingTo === eventId) {
      setAddingTo(null);
      setDraftText("");
    }
  }

  const lockedCategories = categoryOptions?.map((item) => item.trim()).filter(Boolean) ?? [];
  const categoryChoices = [...new Set([...lockedCategories, ...uniqueCategoryLabels(data.events), "기타"])];

  return (
    <div className="fade-in min-h-full px-10 py-8">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">추출 완료</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(34,197,94,0.1)] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
              <span className="size-[5px] rounded-full bg-success" />
              {data.events.length}개 행사 · {totalTasks}개 태스크
            </span>
          </div>
          <h1 className="font-display text-[22px] font-extrabold text-fg">행사 계획 미리보기 &amp; 편집</h1>
          <p className="mt-1 text-[13px] text-fg3">
            {data.club_info.academic_year}년 · {data.club_info.club_name} · 날짜가 비어 있으면 월 기준으로만 추정합니다.
            카드에서 원하는 날짜를 지정한 뒤 달력에 적용하세요.
            {inferredCount > 0
              ? ` 원문에 없던 준비 ${inferredCount}건은 “보충됨”으로 표시됩니다. 필요 없으면 삭제하세요.`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="cursor-pointer rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-semibold text-fg3"
            >
              ← 부서 편집
            </button>
          ) : null}
          <button
            type="button"
            disabled={data.events.length === 0}
            title={data.events.length === 0 ? "적용할 행사가 없습니다." : undefined}
            onClick={() => onApply(data)}
            className="cursor-pointer rounded-[10px] bg-accent px-5 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            달력에 적용 →
          </button>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer rounded-[10px] border border-border px-4 py-2 text-[13px] text-fg3"
            >
              처음부터
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-7 flex gap-0.5 overflow-x-auto border-b border-border">
        {SEMESTER_TABS.map((tab) => {
          const active = term === tab.id;
          return (
            <div
              key={tab.id}
              className="relative"
              onMouseEnter={() => {
                if (tab.tooltip) setTooltipTab(tab.id);
              }}
              onMouseLeave={() => setTooltipTab(null)}
            >
              <button
                type="button"
                onClick={() => setTerm(tab.id)}
                className="flex cursor-pointer flex-col items-start gap-px whitespace-nowrap bg-transparent px-5 pt-3 pb-2.5 text-left text-sm"
                style={{
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--accent)" : "var(--fg3)",
                }}
              >
                {tab.label}
                {tab.sub ? (
                  <span className="text-[11px] font-normal opacity-70">{tab.sub}</span>
                ) : null}
              </button>
              {tooltipTab === tab.id && tab.tooltip ? (
                <div className="pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-10 -translate-x-1/2 rounded-[7px] bg-[#111118] px-2.5 py-1.5 text-[11px] leading-snug whitespace-nowrap text-white">
                  {tab.tooltip}
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-1">
          {roster.map((name) => (
            <RoleChip key={name} name={name} roster={roster} />
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-[60px] text-center text-sm text-fg3">이 학기에 등록된 행사가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
          {visible.map((event) => {
            const pickedDate = event.event_date && isoDateParts(event.event_date) ? event.event_date : "";
            const pickedDateObj = pickedDate ? dateFromIso(pickedDate) : null;
            const doneCount = event.tasks.filter((task, index) => done[taskKey(event.event_id, task, index)]).length;
            const pct = event.tasks.length === 0 ? 0 : Math.round((doneCount / event.tasks.length) * 100);
            const editingName = editingEventId === event.event_id;
            return (
              <article
                key={event.event_id}
                className="relative flex flex-col rounded-2xl border border-border bg-card"
              >
                <header className="relative border-b border-border px-5 pt-[18px] pr-10 pb-3.5">
                  <button
                    type="button"
                    aria-label={`${event.event_name} 삭제`}
                    onMouseDown={(eventClick) => eventClick.preventDefault()}
                    onClick={() => removeEvent(event.event_id)}
                    className="absolute top-2.5 right-2.5 z-10 flex size-8 cursor-pointer items-center justify-center bg-transparent text-[22px] leading-none text-fg3"
                  >
                    ×
                  </button>
                  {editingName ? (
                    <input
                      autoFocus
                      value={eventNameDraft}
                      onChange={(eventChange) => setEventNameDraft(eventChange.target.value)}
                      onKeyDown={(eventKey) => {
                        if (eventKey.key === "Enter") saveEventName();
                        if (eventKey.key === "Escape") setEditingEventId(null);
                      }}
                      onBlur={saveEventName}
                      className="font-display mb-2.5 w-full rounded-md border border-accent bg-bg px-2 py-1 text-[15px] font-bold text-fg outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label={`${event.event_name} 수정`}
                      onClick={() => {
                        setEditingEventId(event.event_id);
                        setEventNameDraft(event.event_name);
                      }}
                      className="font-display mb-2.5 flex w-full cursor-pointer items-start gap-1.5 rounded-md border border-transparent px-0 py-0 text-left text-[15px] font-bold text-fg"
                    >
                      <span className="min-w-0 flex-1">{event.event_name}</span>
                      <PencilSimple
                        size={15}
                        weight="bold"
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-fg3"
                      />
                    </button>
                  )}
                  <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                    <EventCategoryButton
                      category={
                        categoryChoices.includes(event.category) ? event.category : (categoryChoices[0] ?? "")
                      }
                      choices={categoryChoices}
                      open={openCatId === event.event_id}
                      onToggle={() =>
                        setOpenCatId((prev) => (prev === event.event_id ? null : event.event_id))
                      }
                      onSelect={(label) => {
                        setEventCategory(event.event_id, label);
                        setOpenCatId(null);
                      }}
                    />
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <EventDateButton
                        value={pickedDate}
                        today={today}
                        defaultMonth={event.target_month}
                        onChange={(value) => setEventDate(event.event_id, value)}
                      />
                      {pickedDateObj ? <DminusBadge daysLeft={dayDiff(today, pickedDateObj)} /> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-[3px] flex-1 rounded-full bg-border">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? "var(--success)" : "var(--accent)",
                        }}
                      />
                    </div>
                    <span className="tabular shrink-0 text-[11px] text-fg3">
                      {doneCount}/{event.tasks.length}
                    </span>
                  </div>
                </header>

                <div className="flex-1 px-5 py-3">
                  <div className="flex flex-col gap-3">
                    {groupByRole(
                      event.tasks.map((task, index) => ({
                        task,
                        key: taskKey(event.event_id, task, index),
                      })),
                      roster,
                      (item) => item.task.assigned_role,
                    ).map((group) => (
                      <div key={group.role}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <RoleChip name={group.role} roster={roster} />
                          <span className="tabular text-[11px] text-fg3">
                            {group.items.filter((item) => done[item.key]).length}/{group.items.length}
                          </span>
                        </div>
                        {group.items.map(({ task, key }) => {
                          const checked = Boolean(done[key]);
                          const isEditing = editing?.eventId === event.event_id && editing.taskKey === key;
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-2 border-b border-border py-1.5"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDone(key)}
                                className="size-3.5 shrink-0 cursor-pointer accent-[#0066FF]"
                              />
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={editing.text}
                                  onChange={(eventChange) =>
                                    setEditing((prev) => (prev ? { ...prev, text: eventChange.target.value } : prev))
                                  }
                                  onKeyDown={(eventKey) => {
                                    if (eventKey.key === "Enter") saveEdit();
                                    if (eventKey.key === "Escape") setEditing(null);
                                  }}
                                  className="min-w-0 flex-1 rounded-md border border-accent bg-bg px-2 py-0.5 text-[13px] text-fg outline-none"
                                />
                              ) : (
                                <span
                                  className={`min-w-0 flex-1 text-[13px] ${checked ? "text-fg3 line-through opacity-50" : "text-fg"}`}
                                >
                                  {task.task_name}
                                  {isInferredTask(task) ? (
                                    <span
                                      className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded-md px-1.5 py-px text-[10px] font-bold tracking-wide"
                                      style={{
                                        background: "rgba(245,158,11,0.12)",
                                        color: "#b45309",
                                      }}
                                    >
                                      보충됨
                                    </span>
                                  ) : null}
                                </span>
                              )}
                              <div className="flex shrink-0 gap-0.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={saveEdit}
                                      className="cursor-pointer rounded-[5px] border border-accent bg-[rgba(0,102,255,0.08)] px-[7px] py-0.5 text-[11px] font-semibold text-accent"
                                    >
                                      저장
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditing(null)}
                                      className="cursor-pointer rounded-[5px] border border-border bg-transparent px-[7px] py-0.5 text-[11px] text-fg3"
                                    >
                                      취소
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditing({ eventId: event.event_id, taskKey: key, text: task.task_name })
                                      }
                                      className="cursor-pointer rounded-[5px] border border-border bg-transparent px-[7px] py-0.5 text-[11px] text-fg3"
                                    >
                                      편집
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeTask(event.event_id, key)}
                                      className="cursor-pointer rounded-[5px] border border-[#fee2e2] bg-transparent px-[7px] py-0.5 text-[11px] text-danger"
                                    >
                                      삭제
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {addingTo === event.event_id ? (
                    <div className="fade-in mt-2.5 flex gap-1.5">
                      <input
                        autoFocus
                        value={draftText}
                        onChange={(eventChange) => setDraftText(eventChange.target.value)}
                        onKeyDown={(eventKey) => {
                          if (eventKey.key === "Enter") addTask(event.event_id);
                          if (eventKey.key === "Escape") {
                            setAddingTo(null);
                            setDraftText("");
                          }
                        }}
                        placeholder="새 TO-DO 입력..."
                        className="min-w-0 flex-1 rounded-lg border border-accent bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => addTask(event.event_id)}
                        className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white"
                      >
                        추가
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingTo(null);
                          setDraftText("");
                        }}
                        className="cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-[13px] text-fg3"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingTo(event.event_id);
                        setDraftText("");
                      }}
                      className="mt-2.5 w-full cursor-pointer rounded-lg border-[1.5px] border-dashed border-border bg-transparent py-2 text-[12px] font-semibold text-fg3"
                    >
                      + 새 TO-DO 추가
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
