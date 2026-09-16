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
          event.checklist.map((item) => ({
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
    <div className="fade-in h-full overflow-y-auto p-6">
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
