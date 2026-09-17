/**
 * 🧭 UniClub - club-store.ts
 *
 * 동아리 데이터(ClubData) 중에서 특정 행사 하나를 수정할 때 쓰는 파일입니다.
 * 사용자가 행사 이름을 바꾸거나, 날짜를 바꾸거나, 할 일을 추가/삭제/수정할 때 기존 데이터를 건드리지 않고 새 데이터를 만들어 돌려줍니다.
 *
 * 📌 주요 기능:
 * - 행사 이름, 카테고리, 날짜를 수정
 * - 기존 할 일의 마감 기준일(며칠 전)이나 이름을 수정
 * - 기존 할 일을 삭제
 * - 새로운 할 일을 추가 (고유 id 자동 생성)
 *
 * 🔗 사용 예시:
 * ```ts
 * // 행사 수정 화면에서 이렇게 씁니다
 * import { patchClubEvent } from './club-store'
 *
 * const nextData = patchClubEvent(clubData, 'evt_summer_mt', {
 *   event_name: '여름 엠티',
 *   addTask: { task_name: '숙소 예약', days_before_dday: 10 },
 * });
 * ```
 *
 * 🎯 주요 관리 요소:
 * - ClubEventPatch: 행사를 어떻게 수정할지 담는 "수정 지시서" 타입
 * - patchClubEvent(data, eventId, patch): 실제로 데이터를 수정해서 새 ClubData를 반환하는 함수
 *
 * 💡 팁 및 주의사항:
 * - patchClubEvent는 원본 data를 절대 바꾸지 않고(불변성 유지), 항상 새로운 객체를 만들어서 반환합니다. React 상태 관리와 잘 맞습니다.
 * - eventId와 일치하는 행사가 없으면 아무것도 바뀌지 않은 채 원본과 같은 내용의 새 객체가 반환됩니다.
 * - 새 할 일의 id는 newTaskId()가 crypto.randomUUID()로 "draft-..." 형태로 만듭니다.
 *
 * @file club-store.ts
 * @module lib/club-store
 */

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
