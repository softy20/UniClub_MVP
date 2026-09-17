/**
 * 🧭 UniClub - TaskList (TaskRow)
 *
 * 할 일 목록에서 한 줄(할 일 하나)을 어떻게 보여줄지 정하는 컴포넌트입니다.
 * 이름은 TaskList이지만 실제로는 목록의 "행 하나"를 그리는 TaskRow를 내보냅니다.
 *
 * 📌 주요 기능:
 * - 체크박스를 눌러서 할 일을 완료/미완료로 전환
 * - 할 일 이름, 담당 행사, 담당 역할, 마감일을 한 줄로 표시
 * - 줄을 클릭하면 펼쳐져서 상세 설명과 세부 체크리스트를 보여줌
 * - 마감이 얼마 안 남았거나 지난 경우 D-Day 글자 색을 다르게 표시 (지남: 빨강, 임박: 노랑, 그 외: 회색)
 * - "필수" 또는 "선택" 여부를 작은 태그로 표시
 *
 * 🔗 사용 예시:
 * ```tsx
 * // HomeBoard.tsx 등에서 할 일 목록을 그릴 때 한 줄씩 사용합니다.
 * <TaskRow task={task} done={isDone} onToggle={handleToggle} today={new Date()} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): task(할 일 정보), done(완료 여부), onToggle(체크박스 클릭 시 실행할 함수), today(오늘 날짜)
 * - 컴포넌트 안에서 바뀌는 데이터(State): open(상세 내용이 펼쳐져 있는지 여부)
 * - 이 파일이 내보내는 것: TaskRow 컴포넌트
 *
 * 💡 팁 및 주의사항:
 * - 완료 여부(done)는 이 컴포넌트가 직접 저장하지 않고, 항상 외부(Props)에서 받아서 보여주기만 합니다.
 * - 펼침/접힘 상태(open)만 이 컴포넌트 내부에서 관리하는 유일한 state입니다.
 *
 * @file TaskList.tsx
 * @module components/TaskList
 */
import { useState } from "react";
import { CaretDown, CheckSquare, Square } from "@phosphor-icons/react";
import type { BoardTask } from "../lib/types";
import { formatDate, taskDdayLabel } from "../lib/board";

type TaskRowProps = {
  task: BoardTask;
  done: boolean;
  onToggle: (id: string) => void;
  today: Date;
};

export function TaskRow({ task, done, onToggle, today }: TaskRowProps) {
  const [open, setOpen] = useState(false);
  const dday = taskDdayLabel(task.dueDate, today);
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
