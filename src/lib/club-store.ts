import type { ClubData, ClubTask } from "./types";

export type ClubEventPatch = {
  event_name?: string;
  category?: string;
  event_date?: string;
  task?: {
    id: string;
    days_before_dday?: number;
    task_name?: string;
    remove?: boolean;
  };
  addTask?: {
    task_name: string;
    days_before_dday?: number;
    assigned_role?: string;
  };
};

function clubTaskId(eventId: string, task: ClubTask, index: number): string {
  return task.task_id ?? `${eventId}-${index}`;
}

function newTaskId(): string {
  return `draft-${crypto.randomUUID()}`;
}

export function patchClubEvent(data: ClubData, eventId: string, patch: ClubEventPatch): ClubData {
  return {
    ...data,
    events: data.events.map((event) => {
      if (event.event_id !== eventId) return event;
      const next = { ...event };
      if (patch.event_name !== undefined) {
        const name = patch.event_name.trim();
        if (name) next.event_name = name;
      }
      if (patch.category !== undefined) {
        const category = patch.category.trim();
        if (category) next.category = category;
      }
      if (patch.event_date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(patch.event_date)) {
        next.event_date = patch.event_date;
        const month = Number(patch.event_date.slice(5, 7));
        if (month >= 1 && month <= 12) next.target_month = month;
      }
      if (patch.task !== undefined) {
        if (patch.task.remove) {
          next.tasks = next.tasks.filter(
            (task, index) => clubTaskId(eventId, task, index) !== patch.task!.id,
          );
        } else {
          next.tasks = next.tasks.map((task, index) => {
            if (clubTaskId(eventId, task, index) !== patch.task!.id) return task;
            const updated = { ...task };
            if (patch.task!.days_before_dday !== undefined) {
              const days = Math.max(0, Math.round(patch.task!.days_before_dday));
              if (Number.isFinite(days)) updated.days_before_dday = days;
            }
            if (patch.task!.task_name !== undefined) {
              const taskName = patch.task!.task_name.trim();
              if (taskName) updated.task_name = taskName;
            }
            return updated;
          });
        }
      }
      if (patch.addTask !== undefined) {
        const taskName = patch.addTask.task_name.trim();
        if (taskName) {
          const days =
            patch.addTask.days_before_dday === undefined
              ? 7
              : Math.max(0, Math.round(patch.addTask.days_before_dday));
          next.tasks = [
            ...next.tasks,
            {
              task_id: newTaskId(),
              task_name: taskName,
              days_before_dday: Number.isFinite(days) ? days : 7,
              assigned_role: patch.addTask.assigned_role?.trim() || "공통",
              is_mandatory: false,
            },
          ];
        }
      }
      return next;
    }),
  };
}
