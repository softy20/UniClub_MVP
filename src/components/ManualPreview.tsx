import { useMemo, useState } from "react";
import { dayDiff, estimateEventDate } from "../lib/board";
import { readKst } from "../lib/kst";
import type { ClubData, ClubEvent, ClubTask } from "../lib/types";
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
  onChange: (next: ClubData) => void;
  onBack?: () => void;
  onReset?: () => void;
};

type EditingTask = { eventId: string; taskKey: string; text: string };

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
  return data.club_info.roles[0]?.role_name ?? "공통";
}

export function ManualPreview({ data, onChange, onBack, onReset }: ManualPreviewProps) {
  const [term, setTerm] = useState<AcademicTerm>("all");
  const [tooltipTab, setTooltipTab] = useState<AcademicTerm | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EditingTask | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const today = useMemo(() => readKst().civil, []);
  const roster = data.club_info.roles.map((role) => role.role_name);
  const totalTasks = data.events.reduce((sum, event) => sum + event.tasks.length, 0);

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
            {data.club_info.academic_year}년 · {data.club_info.club_name} · 초안만 수정되며 보드에는 아직 반영되지 않습니다.
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
            disabled
            title="보드 동기화는 M5에서 연결됩니다."
            className="rounded-[10px] bg-accent px-5 py-2 text-[13px] font-bold text-white opacity-50"
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
            const eventDate = estimateEventDate(event, data.club_info.academic_year);
            const daysLeft = dayDiff(today, eventDate);
            const roles = [...new Set(event.tasks.map((task) => task.assigned_role).filter(Boolean))];
            const doneCount = event.tasks.filter((task, index) => done[taskKey(event.event_id, task, index)]).length;
            const pct = event.tasks.length === 0 ? 0 : Math.round((doneCount / event.tasks.length) * 100);
            return (
              <article
                key={event.event_id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
              >
                <header className="border-b border-border px-5 pt-[18px] pb-3.5">
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display mb-1.5 text-[15px] font-bold text-fg">{event.event_name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {roles.length > 0 ? (
                          roles.map((role) => <RoleChip key={role} name={role} roster={roster} />)
                        ) : (
                          <RoleChip name={defaultRole(data)} roster={roster} />
                        )}
                      </div>
                    </div>
                    <DminusBadge daysLeft={daysLeft} />
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
                  <div className="flex flex-col">
                    {event.tasks.map((task, index) => {
                      const key = taskKey(event.event_id, task, index);
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
                                  onClick={() => setEditing({ eventId: event.event_id, taskKey: key, text: task.task_name })}
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
