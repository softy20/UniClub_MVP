/**
 * 🧭 UniClub - SeasonSwitcher
 *
 * 헤더에서 지금 보고 있는 학년도(시즌)를 보여주고, 다른 학년도로 전환하거나
 * 지금 데이터를 템플릿 삼아 새 학년도를 시작할 수 있게 해주는 작은 부품입니다.
 *
 * 📌 주요 기능:
 * - 드롭다운으로 저장되어 있는 학년도 중 하나를 골라 전환
 * - "새 학년도" 버튼으로 다음 해를 입력해서 새 시즌 생성 요청
 *
 * 🔗 사용 예시:
 * ```tsx
 * <SeasonSwitcher
 *   clubName={data.club_info.club_name}
 *   activeYear={data.club_info.academic_year}
 *   seasons={seasons}
 *   onSwitch={switchSeason}
 *   onStartNewSeason={startNewSeason}
 * />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - Props: clubName, activeYear, seasons(저장된 학년도 목록), onSwitch, onStartNewSeason
 * - State: adding(새 학년도 입력 중인지), draftYear(입력 중인 연도 문자열)
 *
 * 💡 팁 및 주의사항:
 * - seasons 목록에 activeYear가 없을 수도 있어(막 만든 시즌 등) 항상 합쳐서 보여줍니다.
 *
 * @file SeasonSwitcher.tsx
 * @module components/SeasonSwitcher
 */
import { useState } from "react";
import { Plus } from "@phosphor-icons/react";

type SeasonSwitcherProps = {
  clubName: string;
  activeYear: number;
  seasons: number[];
  onSwitch: (year: number) => void;
  onStartNewSeason: (year: number) => void;
};

export function SeasonSwitcher({ clubName, activeYear, seasons, onSwitch, onStartNewSeason }: SeasonSwitcherProps) {
  const [adding, setAdding] = useState(false);
  const [draftYear, setDraftYear] = useState(() => String(activeYear + 1));
  const years = [...new Set([...seasons, activeYear])].sort((a, b) => b - a);

  function startAdding() {
    setDraftYear(String(activeYear + 1));
    setAdding(true);
  }

  function submitNewSeason() {
    const year = Math.round(Number(draftYear));
    if (!Number.isFinite(year) || year < 2000 || year > 3000) return;
    onStartNewSeason(year);
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor="season-switcher">
        학년도 선택
      </label>
      <select
        id="season-switcher"
        value={activeYear}
        onChange={(event) => onSwitch(Number(event.target.value))}
        aria-label="학년도 전환"
        className="tabular cursor-pointer rounded-md border border-border bg-transparent px-1.5 py-0.5 text-[12px] font-medium text-fg3 outline-none"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}년
          </option>
        ))}
      </select>
      <span className="hidden text-[12px] text-fg3 sm:inline">· {clubName}</span>

      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            inputMode="numeric"
            value={draftYear}
            onChange={(event) => setDraftYear(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitNewSeason();
              if (event.key === "Escape") setAdding(false);
            }}
            aria-label="새 학년도 연도"
            className="tabular w-14 rounded-md border border-accent bg-bg px-1.5 py-0.5 text-[12px] text-fg outline-none"
          />
          <button
            type="button"
            onClick={submitNewSeason}
            className="cursor-pointer rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-accent"
          >
            시작
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="cursor-pointer rounded-md px-1.5 py-0.5 text-[12px] text-fg3"
          >
            취소
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={startAdding}
          aria-label="새 학년도 시작"
          className="flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-fg3 transition-colors duration-150 hover:bg-card2"
        >
          <Plus size={11} weight="bold" aria-hidden="true" />새 학년도
        </button>
      )}
    </div>
  );
}
