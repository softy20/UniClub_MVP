/**
 * 🧭 UniClub - EventPanel
 *
 * 행사 하나를 클릭했을 때 화면 오른쪽에서 슬라이드로 열리는 상세 패널입니다.
 * 행사 제목, 날짜, 카테고리를 확인하고 수정할 수 있고, 체크리스트와 메모를 볼 수 있습니다.
 *
 * 📌 주요 기능:
 * - 행사 제목을 클릭해서 바로 수정 (수정 가능한 행사인 경우)
 * - 카테고리, 날짜를 드롭다운/달력 버튼으로 바로 변경
 * - 체크리스트 진행률(완료/전체, 퍼센트)을 막대그래프로 표시
 * - "체크리스트" 탭과 "메모" 탭을 전환하며 볼 수 있음
 * - 체크리스트는 부서(역할)별로 묶어서 RoleTodoGroups 컴포넌트로 보여줌
 * - 닫기 버튼을 누르면 패널을 닫도록 상위 화면에 알림
 *
 * 🔗 사용 예시:
 * ```tsx
 * // App.tsx 등에서 행사를 선택했을 때 이 패널을 띄웁니다.
 * <EventPanel
 *   event={selectedEvent}
 *   today={new Date()}
 *   roster={memberList}
 *   categories={categoryList}
 *   onClose={() => setSelectedEvent(null)}
 *   onToggle={(checkId) => toggleChecklistItem(checkId)}
 *   onPatch={(eventId, patch) => updateEvent(eventId, patch)}
 * />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): event(선택된 행사 정보), today(오늘 날짜), roster(멤버 목록),
 *   categories(카테고리 목록), onClose(패널 닫기 함수), onToggle(체크리스트 항목 토글 함수), onPatch(행사 정보 수정 함수)
 * - 컴포넌트 안에서 바뀌는 데이터(State): tab(체크리스트/메모 중 어느 탭이 열려있는지),
 *   editingTitle(제목을 수정 중인지), titleDraft(입력 중인 제목 임시 값), openCat(카테고리 드롭다운 열림 여부)
 * - 이 파일이 내보내는 것: EventPanel 컴포넌트
 *
 * 💡 팁 및 주의사항:
 * - event.id가 바뀌면(다른 행사를 선택하면) 제목 수정 상태와 카테고리 드롭다운이 자동으로 초기화됩니다.
 * - 실제 데이터 저장은 이 컴포넌트가 직접 하지 않고, onPatch/onToggle을 통해 상위 컴포넌트로 위임합니다.
 * - editable이 false인 행사는 제목/카테고리/날짜를 수정할 수 없고 읽기 전용으로만 표시됩니다.
 *
 * @file EventPanel.tsx
 * @module components/EventPanel
 */
import { useEffect, useMemo, useState } from "react";
import { PencilSimple, X } from "@phosphor-icons/react";
import { toDateInputValue } from "../lib/board";
import type { ClubEventPatch } from "../lib/club-store";
import type { OpsEvent } from "../lib/ops";
import { EventCategoryButton, EventDateButton } from "./EventEditors";
import { DdayBadge, Tag } from "./marks";
import { RoleTodoGroups } from "./RoleTodoGroups";

type EventPanelProps = {
  event: OpsEvent;
  today: Date;
  roster: string[];
  categories: string[];
  presentation?: "drawer" | "sheet";
  onClose: () => void;
  onToggle: (checkId: string) => void;
  onPatch: (eventId: string, patch: ClubEventPatch) => void;
};

export function EventPanel({
  event,
  today,
  roster,
  categories,
  presentation = "drawer",
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
  const todoItems = useMemo(
    () =>
      [...event.checklist]
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .map((item) => ({
          ...item,
          eventId: event.id,
          editable: event.editable,
        })),
    [event.checklist, event.editable, event.id],
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

  const sheet = presentation === "sheet";

  return (
    <div
      className={
        sheet
          ? "sheet-up fixed inset-x-0 bottom-0 z-40 flex h-[min(92dvh,92%)] flex-col rounded-t-[20px] border-t border-border2 bg-card pb-[env(safe-area-inset-bottom,0px)]"
          : "slide-in fixed top-0 right-0 z-40 flex h-full w-[min(400px,100vw)] flex-col border-l border-border2 bg-card"
      }
    >
      {sheet ? (
        <div className="flex shrink-0 justify-center pt-2.5">
          <div className="h-1 w-9 rounded-full bg-border2" aria-hidden="true" />
        </div>
      ) : null}
      <div className={`flex items-start justify-between border-b border-border ${sheet ? "px-5 pt-3 pb-4" : "p-5"}`}>
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
          <RoleTodoGroups
            heading="부서별 TO-DO"
            items={todoItems}
            roster={roster}
            variant="panel"
            canEdit={event.editable}
            resetKey={event.id}
            defaultEventId={event.id}
            emptyText="이 행사에 적힌 할 일이 없습니다."
            onToggle={onToggle}
            onPatch={onPatch}
          />
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
