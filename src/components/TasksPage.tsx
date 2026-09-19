/**
 * 🧭 UniClub - TasksPage (할 일 목록 페이지)
 *
 * 모든 행사에 딸린 할 일(TO-DO)들을 한곳에 모아서, 부서별로 묶어 보여주는 화면입니다.
 * 카테고리(행사 분류)로 필터링해서 원하는 할 일만 골라 볼 수 있습니다.
 *
 * 📌 주요 기능:
 * - 여러 행사에 흩어져 있는 할 일들을 하나의 목록으로 합칩니다.
 * - 마감이 가까운 순서(daysLeft 기준)로 할 일을 정렬합니다.
 * - 카테고리 필터로 원하는 분류의 할 일만 보이게 걸러줍니다.
 * - 할 일 체크(완료 표시)와 할 일 수정(RoleTodoGroups에 위임)을 지원합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * import { TasksPage } from "./components/TasksPage";
 * <TasksPage
 *   events={events}
 *   roster={["기획팀", "홍보팀"]}
 *   onToggle={(id) => toggleTask(id)}
 *   onPatch={(eventId, patch) => updateEvent(eventId, patch)}
 * />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): events(전체 행사 목록), roster(부서 이름 목록),
 *   onToggle(할 일 체크박스를 눌렀을 때 실행할 함수), onPatch(할 일 내용을 고칠 때 실행할 함수)
 * - 컴포넌트 안에서 바뀌는 데이터(State): active(현재 켜져 있는 카테고리 목록)
 * - 의존성: ../lib/club-store(할 일 수정 타입), ../lib/ops(분류 목록 뽑기), ./marks(카테고리 필터),
 *   ./RoleTodoGroups(부서별 할 일 목록 실제로 그려주는 컴포넌트)
 *
 * 💡 팁 및 주의사항:
 * - 이 화면은 화면을 직접 그리기보다는 대부분의 일(부서별로 묶기, 항목 표시)을
 *   RoleTodoGroups 컴포넌트에 맡기고, 이 파일은 데이터를 준비해서 넘겨주는 역할을 합니다.
 * - 편집 가능한 행사(editable)가 하나도 없으면 새 할 일을 추가할 수 없습니다.
 *
 * @file TasksPage.tsx
 * @module components/TasksPage
 */
import { useEffect, useMemo, useState } from "react";
import type { ClubEventPatch } from "../lib/club-store";
import { uniqueCategoryLabels, type OpsEvent } from "../lib/ops";
import { CategoryFilter } from "./marks";
import { RoleTodoGroups, type RoleTodoItem } from "./RoleTodoGroups";

type TasksPageProps = {
  events: OpsEvent[];
  roster: string[];
  onToggle: (checkId: string) => void;
  onPatch: (eventId: string, patch: ClubEventPatch) => void;
};

export function TasksPage({ events, roster, onToggle, onPatch }: TasksPageProps) {
  const categories = useMemo(() => uniqueCategoryLabels(events), [events]);
  const [active, setActive] = useState<Set<string>>(() => new Set(categories));
  const categoryKey = categories.join("|");

  useEffect(() => {
    setActive(new Set(categories));
  }, [categoryKey]);

  const items = useMemo<RoleTodoItem[]>(
    () =>
      [...events]
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .flatMap((event) =>
          [...event.checklist]
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .map((item) => ({
              ...item,
              eventId: event.id,
              eventTitle: event.title,
              category: event.category,
              editable: event.editable,
            })),
        )
        .filter((task) => active.has(task.category)),
    [events, active],
  );

  const eventChoices = useMemo(
    () =>
      [...events]
        .filter((event) => event.editable)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .map((event) => ({ id: event.id, title: event.title })),
    [events],
  );

  return (
    <div className="fade-in h-full overflow-y-auto p-4 md:p-6">
      <RoleTodoGroups
        heading="부서별 할 일"
        items={items}
        roster={roster}
        variant="tasks"
        canEdit={eventChoices.length > 0}
        eventChoices={eventChoices}
        emptyText="표시할 할 일이 없습니다."
        filters={
          <div className="mb-1">
            <CategoryFilter
              events={events}
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
                setActive((prev) =>
                  categories.every((cat) => prev.has(cat)) ? new Set() : new Set(categories),
                )
              }
            />
          </div>
        }
        onToggle={onToggle}
        onPatch={onPatch}
      />
    </div>
  );
}
