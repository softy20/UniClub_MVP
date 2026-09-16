import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { ClubEventPatch } from "../lib/club-store";
import { groupByRole } from "../lib/ops";
import { DdayBadge, RoleChip, RoleSelect, Tag } from "./marks";

export type RoleTodoItem = {
  id: string;
  eventId: string;
  text: string;
  done: boolean;
  role: string;
  daysBefore: number;
  eventTitle?: string;
  category?: string;
  editable?: boolean;
};

export type RoleTodoEventChoice = {
  id: string;
  title: string;
};

const COMMON_ROLE = "공통";

const TOGGLE_BASE = "cursor-pointer rounded px-3 py-1.5 text-xs";

function toggleStyle(active: boolean): CSSProperties {
  return {
    background: active ? "var(--accent)" : "var(--card)",
    color: active ? "#fff" : "var(--fg3)",
    border: "1px solid var(--border)",
  };
}

export function CompletedTodosToggle({
  showDone,
  onToggle,
}: {
  showDone: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className={TOGGLE_BASE} style={toggleStyle(showDone)}>
      {showDone ? "완료 안보기" : "완료 보기"}
    </button>
  );
}

export function TodoEditModeToggle({
  editing,
  onToggle,
}: {
  editing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={editing}
      className={TOGGLE_BASE}
      style={toggleStyle(editing)}
    >
      {editing ? "수정 완료" : "TO-DO 수정"}
    </button>
  );
}

export function RoleGroupHeader({
  role,
  roster,
  count,
  open,
  onToggle,
  controlsId,
}: {
  role: string;
  roster: string[];
  count: ReactNode;
  open: boolean;
  onToggle: () => void;
  controlsId: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
      className="mb-2 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-transparent p-0 text-left"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 text-fg3 transition-transform duration-150 ${open ? "" : "rotate-[-90deg]"}`}
        />
        <RoleChip name={role} roster={roster} />
      </span>
      <span className="tabular shrink-0 text-[11px] text-fg3">{count}</span>
    </button>
  );
}

export function TodoItemActions({
  isEditingName,
  onSave,
  onCancel,
  onEdit,
  onDelete,
}: {
  isEditingName: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {isEditingName ? (
        <>
          <button
            type="button"
            onClick={onSave}
            className="cursor-pointer rounded-[5px] border border-accent bg-[rgba(0,102,255,0.08)] px-[7px] py-0.5 text-[11px] font-semibold text-accent"
          >
            저장
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[5px] border border-border bg-transparent px-[7px] py-0.5 text-[11px] text-fg3"
          >
            취소
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer rounded-[5px] border border-border bg-transparent px-[7px] py-0.5 text-[11px] text-fg3"
          >
            편집
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="cursor-pointer rounded-[5px] border border-[#fee2e2] bg-transparent px-[7px] py-0.5 text-[11px] text-danger"
          >
            삭제
          </button>
        </>
      )}
    </div>
  );
}

export function TodoAddForm({
  draft,
  onDraft,
  onSubmit,
  onCancel,
  extra,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="fade-in mt-2.5 flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(change) => onDraft(change.target.value)}
          onKeyDown={(key) => {
            if (key.key === "Enter") onSubmit();
            if (key.key === "Escape") onCancel();
          }}
          placeholder="새 TO-DO 입력..."
          className="min-w-0 flex-1 rounded-lg border border-accent bg-bg px-2.5 py-1.5 text-[13px] text-fg outline-none"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white"
        >
          추가
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-[13px] text-fg3"
        >
          취소
        </button>
      </div>
      {extra}
    </div>
  );
}

function AddEventPicker({
  value,
  choices,
  onChange,
}: {
  value: string;
  choices: RoleTodoEventChoice[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-fg3">
      행사
      <select
        value={value}
        onChange={(change) => onChange(change.target.value)}
        className="min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px] text-fg outline-none"
      >
        {choices.map((event) => (
          <option key={event.id} value={event.id}>
            {event.title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TodoAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2.5 w-full cursor-pointer rounded-lg border-[1.5px] border-dashed border-border bg-transparent py-2 text-[12px] font-semibold text-fg3"
    >
      + 새 TO-DO 추가
    </button>
  );
}

function parseDaysBefore(raw: string): number | null {
  const match = /^(?:D-?)?(\d+)$/i.exec(raw.trim());
  if (!match) return null;
  return Number(match[1]);
}

function groupKey(role: string): string {
  return `role-todos-${role.replace(/\s+/g, "-")}`;
}

type RoleTodoGroupsProps = {
  heading: string;
  items: RoleTodoItem[];
  roster: string[];
  variant: "panel" | "tasks";
  canEdit?: boolean;
  resetKey?: string;
  defaultEventId?: string;
  eventChoices?: RoleTodoEventChoice[];
  emptyText?: string;
  filters?: ReactNode;
  onToggle: (id: string) => void;
  onPatch: (eventId: string, patch: ClubEventPatch) => void;
};

export function RoleTodoGroups({
  heading,
  items,
  roster,
  variant,
  canEdit = false,
  resetKey,
  defaultEventId,
  eventChoices = [],
  emptyText = "표시할 할 일이 없습니다.",
  filters,
  onToggle,
  onPatch,
}: RoleTodoGroupsProps) {
  const [showDone, setShowDone] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState("");
  const [editingDdayId, setEditingDdayId] = useState<string | null>(null);
  const [ddayDraft, setDdayDraft] = useState("");
  const [addingRole, setAddingRole] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [addEventId, setAddEventId] = useState(defaultEventId ?? eventChoices[0]?.id ?? "");

  useEffect(() => {
    setShowDone(false);
    setManageMode(false);
    setCollapsed(new Set());
    setEditingTaskId(null);
    setEditingDdayId(null);
    setAddingRole(null);
    setDraftText("");
    setAddEventId(defaultEventId ?? eventChoices[0]?.id ?? "");
  }, [resetKey]);

  const addTargets = eventChoices.length > 0 ? eventChoices : defaultEventId ? [{ id: defaultEventId, title: "" }] : [];
  const canAdd = canEdit && addTargets.length > 0;

  const groups = useMemo(() => {
    return groupByRole(items, roster, (item) => item.role)
      .map((group) => {
        const visible = showDone ? group.items : group.items.filter((item) => !item.done);
        return {
          role: group.role,
          all: group.items,
          visible,
          doneCount: group.items.filter((item) => item.done).length,
        };
      })
      .filter((group) => group.visible.length > 0);
  }, [items, roster, showDone]);

  const roleChoices = useMemo(() => {
    const used = items.map((item) => item.role.trim() || COMMON_ROLE);
    const choices = [...new Set([...roster, ...used])].filter(Boolean);
    return choices.length > 0 ? choices : [COMMON_ROLE];
  }, [items, roster]);

  const visibleCount = items.filter((item) => showDone || !item.done).length;

  function isOpen(role: string): boolean {
    return !collapsed.has(role);
  }

  function toggleRole(role: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function expandRole(role: string) {
    setCollapsed((prev) => {
      if (!prev.has(role)) return prev;
      const next = new Set(prev);
      next.delete(role);
      return next;
    });
  }

  function startTaskEdit(item: RoleTodoItem) {
    setEditingDdayId(null);
    setEditingTaskId(item.id);
    setTaskDraft(item.text);
  }

  function saveTask(item: RoleTodoItem) {
    const next = taskDraft.trim();
    if (next && next !== item.text) onPatch(item.eventId, { task: { id: item.id, task_name: next } });
    setEditingTaskId(null);
  }

  function removeTask(item: RoleTodoItem) {
    if (editingDdayId === item.id) setEditingDdayId(null);
    if (editingTaskId === item.id) setEditingTaskId(null);
    onPatch(item.eventId, { task: { id: item.id, remove: true } });
  }

  function startDdayEdit(item: RoleTodoItem) {
    setEditingTaskId(null);
    setEditingDdayId(item.id);
    setDdayDraft(String(item.daysBefore));
  }

  function saveDday(item: RoleTodoItem) {
    const parsed = parseDaysBefore(ddayDraft);
    if (parsed !== null && parsed !== item.daysBefore) {
      onPatch(item.eventId, { task: { id: item.id, days_before_dday: parsed } });
    }
    setEditingDdayId(null);
  }

  function startAdd() {
    const role = groups[0]?.role ?? roleChoices[0] ?? COMMON_ROLE;
    expandRole(role);
    setAddingRole(role);
    setDraftText("");
    setAddEventId(defaultEventId ?? eventChoices[0]?.id ?? addEventId);
  }

  function submitAdd(role: string) {
    const text = draftText.trim();
    const eventId = defaultEventId ?? addEventId;
    if (!text || !eventId) return;
    const assigned = role || COMMON_ROLE;
    onPatch(eventId, { addTask: { task_name: text, assigned_role: assigned } });
    expandRole(assigned);
    setDraftText("");
    setAddingRole(null);
  }

  function cancelAdd() {
    setAddingRole(null);
    setDraftText("");
  }

  function exitManageMode() {
    setManageMode(false);
    setEditingTaskId(null);
    setEditingDdayId(null);
    cancelAdd();
  }

  const headingCount =
    variant === "tasks"
      ? `${visibleCount}개${showDone ? "" : " 미완료"}`
      : `${items.filter((item) => item.done).length}/${items.length}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[12px] tracking-widest text-fg3 uppercase">
          {heading}
          {variant === "tasks" ? ` · ${headingCount}` : ""}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <CompletedTodosToggle showDone={showDone} onToggle={() => setShowDone((value) => !value)} />
          {canEdit ? (
            <TodoEditModeToggle
              editing={manageMode}
              onToggle={() => (manageMode ? exitManageMode() : setManageMode(true))}
            />
          ) : null}
        </div>
      </div>
      {filters}

      {groups.map((group) => {
        const open = isOpen(group.role);
        const listId = groupKey(group.role);
        const count =
          variant === "panel"
            ? `${group.doneCount}/${group.all.length}`
            : `${group.visible.length}개`;
        return (
          <section key={group.role}>
            <RoleGroupHeader
              role={group.role}
              roster={roster}
              count={count}
              open={open}
              onToggle={() => toggleRole(group.role)}
              controlsId={listId}
            />
            {open ? (
              <div id={listId} className="flex flex-col gap-2">
                {group.visible.map((item) => {
                  const isEditingName = editingTaskId === item.id;
                  const itemEditable = Boolean(canEdit && item.editable !== false);
                  const showChrome = manageMode && itemEditable;
                  return (
                    <TodoRow
                      key={item.id}
                      item={item}
                      variant={variant}
                      showChrome={showChrome}
                      isEditingName={isEditingName}
                      editingDday={showChrome && editingDdayId === item.id}
                      taskDraft={taskDraft}
                      ddayDraft={ddayDraft}
                      onToggle={() => onToggle(item.id)}
                      onTaskDraft={setTaskDraft}
                      onDdayDraft={setDdayDraft}
                      onSaveTask={() => saveTask(item)}
                      onCancelTask={() => setEditingTaskId(null)}
                      onStartTask={() => startTaskEdit(item)}
                      onRemove={() => removeTask(item)}
                      onSaveDday={() => saveDday(item)}
                      onCancelDday={() => setEditingDdayId(null)}
                      onStartDday={() => startDdayEdit(item)}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}

      {groups.length === 0 ? (
        <div className={variant === "tasks" ? "py-16 text-center" : undefined}>
          <p className={`text-fg3 ${variant === "tasks" ? "font-display font-semibold" : "text-sm"}`}>{emptyText}</p>
        </div>
      ) : null}

      {manageMode && canAdd ? (
        addingRole !== null ? (
          <TodoAddForm
            draft={draftText}
            onDraft={setDraftText}
            onSubmit={() => submitAdd(addingRole)}
            onCancel={cancelAdd}
            extra={
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-fg3">담당</span>
                  <RoleSelect
                    value={addingRole}
                    choices={roleChoices}
                    roster={roster}
                    onChange={(role) => {
                      expandRole(role);
                      setAddingRole(role);
                    }}
                  />
                </div>
                {!defaultEventId && eventChoices.length > 0 ? (
                  <AddEventPicker value={addEventId} choices={eventChoices} onChange={setAddEventId} />
                ) : null}
              </>
            }
          />
        ) : (
          <TodoAddButton onClick={startAdd} />
        )
      ) : null}
    </div>
  );
}

function TodoRow({
  item,
  variant,
  showChrome,
  isEditingName,
  editingDday,
  taskDraft,
  ddayDraft,
  onToggle,
  onTaskDraft,
  onDdayDraft,
  onSaveTask,
  onCancelTask,
  onStartTask,
  onRemove,
  onSaveDday,
  onCancelDday,
  onStartDday,
}: {
  item: RoleTodoItem;
  variant: "panel" | "tasks";
  showChrome: boolean;
  isEditingName: boolean;
  editingDday: boolean;
  taskDraft: string;
  ddayDraft: string;
  onToggle: () => void;
  onTaskDraft: (value: string) => void;
  onDdayDraft: (value: string) => void;
  onSaveTask: () => void;
  onCancelTask: () => void;
  onStartTask: () => void;
  onRemove: () => void;
  onSaveDday: () => void;
  onCancelDday: () => void;
  onStartDday: () => void;
}) {
  const ddayControl = editingDday ? (
    <div className="flex h-5 shrink-0 items-center gap-[5px] text-[13px] leading-5 font-semibold text-[#888]">
      <span
        className="size-[7px] shrink-0 rounded-full"
        style={{
          background: Number(ddayDraft) <= 1 ? "#ef4444" : Number(ddayDraft) <= 7 ? "#eab308" : "#22c55e",
        }}
      />
      <span>D-</span>
      <input
        autoFocus
        inputMode="numeric"
        value={ddayDraft}
        onChange={(change) => onDdayDraft(change.target.value)}
        onKeyDown={(key) => {
          if (key.key === "Enter") onSaveDday();
          if (key.key === "Escape") onCancelDday();
        }}
        onBlur={onSaveDday}
        className="tabular h-5 w-9 rounded-md border border-accent bg-bg px-1 text-[13px] leading-5 font-semibold text-fg outline-none"
        aria-label={`${item.text} D-Day`}
      />
    </div>
  ) : showChrome ? (
    <button
      type="button"
      onClick={onStartDday}
      aria-label={`${item.text} D-Day 수정`}
      className="flex h-5 shrink-0 cursor-pointer items-center border-0 bg-transparent p-0"
    >
      <DdayBadge dday={`D-${item.daysBefore}`} />
    </button>
  ) : (
    <span className="flex h-5 shrink-0 items-center">
      <DdayBadge dday={`D-${item.daysBefore}`} />
    </span>
  );

  const nameControl = isEditingName ? (
    <input
      autoFocus
      value={taskDraft}
      onChange={(change) => onTaskDraft(change.target.value)}
      onKeyDown={(key) => {
        if (key.key === "Enter") onSaveTask();
        if (key.key === "Escape") onCancelTask();
      }}
      className="min-w-0 flex-1 rounded-md border border-accent bg-bg px-2 py-0.5 text-sm leading-5 text-fg outline-none"
      aria-label={`${item.text} 수정`}
    />
  ) : (
    <span
      className={`min-w-0 flex-1 text-sm leading-5 text-fg ${item.done ? "line-through opacity-40" : ""} ${variant === "tasks" ? "font-display" : ""}`}
    >
      {item.text}
    </span>
  );

  const actions = showChrome ? (
    <TodoItemActions
      isEditingName={isEditingName}
      onSave={onSaveTask}
      onCancel={onCancelTask}
      onEdit={onStartTask}
      onDelete={onRemove}
    />
  ) : null;

  if (variant === "tasks") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
        <span className="flex h-5 shrink-0 items-center">
          <input
            id={`check-${item.id}`}
            type="checkbox"
            checked={item.done}
            onChange={onToggle}
            aria-label={item.text}
            className="size-4 shrink-0 cursor-pointer accent-indigo-500"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {nameControl}
            {actions}
          </div>
          {item.category || item.eventTitle ? (
            <div className="mt-1 flex items-center gap-2">
              {item.category ? <Tag cat={item.category} /> : null}
              {item.eventTitle ? <span className="text-[12px] text-fg3">{item.eventTitle}</span> : null}
            </div>
          ) : null}
        </div>
        {ddayControl}
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2.5 rounded-lg p-3"
      style={{ background: item.done ? "rgba(34,197,94,0.06)" : "var(--card2)" }}
    >
      <span className="flex h-5 shrink-0 items-center">
        <input
          id={`check-${item.id}`}
          type="checkbox"
          checked={item.done}
          onChange={onToggle}
          aria-label={item.text}
          className="size-4 cursor-pointer accent-indigo-500"
        />
      </span>
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {ddayControl}
        {nameControl}
      </div>
      {actions}
    </div>
  );
}
