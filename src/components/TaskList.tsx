import { useState } from "react";
import { CaretDown, CheckSquare, Square } from "@phosphor-icons/react";
import type { BoardTask } from "../lib/types";
import { TODAY, formatDate, taskDdayLabel } from "../lib/board";

type TaskRowProps = {
  task: BoardTask;
  done: boolean;
  onToggle: (id: string) => void;
};

export function TaskRow({ task, done, onToggle }: TaskRowProps) {
  const [open, setOpen] = useState(false);
  const dday = taskDdayLabel(task.dueDate, TODAY);
  const toneClass =
    dday.tone === "late"
      ? "text-red-fg"
      : dday.tone === "today" || dday.tone === "soon"
        ? "text-yellow-fg"
        : "text-muted";
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          aria-pressed={done}
          aria-label={done ? `${task.name} 완료 취소` : `${task.name} 완료`}
          className="flex w-11 shrink-0 cursor-pointer items-center justify-center text-ink"
        >
          {done ? (
            <CheckSquare size={22} weight="bold" aria-hidden="true" />
          ) : (
            <Square size={22} weight="bold" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-w-0 flex-1 cursor-pointer px-1 py-3.5 text-left"
        >
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[14px] leading-snug text-ink ${done ? "text-muted line-through" : ""}`}
              >
                {task.name}
              </span>
              <span className="mt-1 block text-[12px] text-muted">
                {task.eventName} · {task.role} · {formatDate(task.dueDate)}
              </span>
            </span>
            <CaretDown
              size={14}
              weight="bold"
              aria-hidden="true"
              className={`mt-1 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        <div className="flex shrink-0 flex-col items-end justify-center gap-1 py-3.5 pr-4">
          <span className={`tabular text-[12px] font-medium ${toneClass}`}>{dday.text}</span>
          {task.mandatory ? (
            <span className="rounded-full bg-red-bg px-2 py-0.5 text-[10px] font-medium tracking-[0.05em] text-red-fg">
              필수
            </span>
          ) : (
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium tracking-[0.05em] text-muted">
              선택
            </span>
          )}
        </div>
      </div>

      {open ? (
        <div className="mx-4 mb-3.5 rounded-[8px] border border-line bg-detail px-4 py-3">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink">
            {task.details ?? "이 할 일에 적힌 상세 수칙이 없습니다."}
          </p>
          {task.checklist.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {task.checklist.map((item) => (
                <li key={item} className="text-[13px] text-muted">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
