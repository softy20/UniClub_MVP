import { CLUB_GENRES, type ClubEvent, type ClubGenre, type ClubProfile } from "../../lib/types";
import { RoleChip, Tag } from "../marks";
import { AddRow } from "./AddRow";
import { ChipRenameInput } from "./ChipRenameInput";
import { PARSE_HALVES } from "./constants";
import { ParseProgressBar } from "./ParseProgressBar";
import type { ParseHalf } from "./types";

type LockedPhaseProps = {
  profile: ClubProfile;
  roleRoster: string[];
  loading: boolean;
  error: string;
  genre: ClubGenre;
  onGenreChange: (genre: ClubGenre) => void;
  // 부서 편집
  editingRole: string | null;
  editingRoleText: string;
  newRoleName: string;
  onEditingRoleTextChange: (value: string) => void;
  onStartRoleRename: (name: string) => void;
  onCommitRoleRename: () => void;
  onCancelRoleRename: () => void;
  onRemoveRole: (name: string) => void;
  onNewRoleNameChange: (value: string) => void;
  onAddRole: () => void;
  // 행사 분류 편집
  editingCategory: string | null;
  editingCategoryText: string;
  newCategoryName: string;
  onEditingCategoryTextChange: (value: string) => void;
  onStartCategoryRename: (label: string) => void;
  onCommitCategoryRename: () => void;
  onCancelCategoryRename: () => void;
  onRemoveCategory: (label: string) => void;
  onNewCategoryNameChange: (value: string) => void;
  onAddCategory: () => void;
  // 일정 추출 진행 상태 (useEventExtraction)
  firstEvents: ClubEvent[] | null;
  secondEvents: ClubEvent[] | null;
  failedHalves: ParseHalf[];
  parseStep: string;
  parseFill: number;
  onParse: (halves?: ParseHalf[]) => void;
  onReset: () => void;
};

/**
 * 부서표가 확정된 뒤, 부서/행사 분류/장르를 확인·수정하고 일정 추출을 시작하는 단계 화면.
 * 특이사항: 상태는 부모(편집 상태)와 useEventExtraction(추출 진행 상태)이 들고 있고, 이 컴포넌트는
 * 값과 콜백만 받는다. 실패한 반기가 있으면 추출 버튼이 반기별 "다시 파싱" 버튼으로 바뀐다.
 */
export function LockedPhase({
  profile,
  roleRoster,
  loading,
  error,
  genre,
  onGenreChange,
  editingRole,
  editingRoleText,
  newRoleName,
  onEditingRoleTextChange,
  onStartRoleRename,
  onCommitRoleRename,
  onCancelRoleRename,
  onRemoveRole,
  onNewRoleNameChange,
  onAddRole,
  editingCategory,
  editingCategoryText,
  newCategoryName,
  onEditingCategoryTextChange,
  onStartCategoryRename,
  onCommitCategoryRename,
  onCancelCategoryRename,
  onRemoveCategory,
  onNewCategoryNameChange,
  onAddCategory,
  firstEvents,
  secondEvents,
  failedHalves,
  parseStep,
  parseFill,
  onParse,
  onReset,
}: LockedPhaseProps) {
  return (
    <section className="flex flex-col py-8">
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[14px] bg-[rgba(0,102,255,0.1)] text-[22px]">
          🔒
        </div>
        <h2 className="font-display mb-2 text-[22px] font-extrabold text-fg md:text-[26px]">부서와 행사 분류를 확인해 주세요</h2>
        <p className="text-sm text-fg3">
          {profile.club_name} · {profile.academic_year}년. 아래 목록으로 연간 행사를 분류합니다. 추가하거나 삭제한 뒤
          다음으로 넘어가세요.
        </p>
      </div>
      <div className="mb-5 rounded-[20px] border border-border bg-card p-5 md:p-8">
        <p className="mb-4 text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">현재 팀 목록</p>
        <div className="mb-0 flex flex-wrap items-center gap-2.5">
          {profile.roles.map((role) =>
            editingRole === role.role_name ? (
              <ChipRenameInput
                key={role.role_name}
                value={editingRoleText}
                onChange={onEditingRoleTextChange}
                onCommit={onCommitRoleRename}
                onCancel={onCancelRoleRename}
              />
            ) : (
              <RoleChip
                key={role.role_name}
                name={role.role_name}
                roster={roleRoster}
                onClick={
                  loading
                    ? undefined
                    : () => onStartRoleRename(role.role_name)
                }
                onRemove={loading ? undefined : () => onRemoveRole(role.role_name)}
              />
            ),
          )}
        </div>
        {profile.roles.length === 1 && profile.roles[0].role_name === "공통" ? (
          <p className="mt-4 text-[12px] text-fg3">역할이 없어도 공통으로 일정을 만들 수 있습니다.</p>
        ) : null}
        <AddRow
          value={newRoleName}
          placeholder="새 부서 이름 입력 후 Enter..."
          onChange={onNewRoleNameChange}
          onAdd={onAddRole}
          disabled={loading}
        />
      </div>
      <div className="mb-5 rounded-[20px] border border-border bg-card p-5 md:p-8">
        <p className="mb-4 text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">행사 분류</p>
        <div className="flex flex-wrap items-center gap-2.5">
          {profile.categories.map((item) =>
            editingCategory === item.label ? (
              <ChipRenameInput
                key={item.label}
                value={editingCategoryText}
                onChange={onEditingCategoryTextChange}
                onCommit={onCommitCategoryRename}
                onCancel={onCancelCategoryRename}
              />
            ) : (
              <Tag
                key={item.label}
                cat={item.label}
                onClick={
                  loading
                    ? undefined
                    : () => onStartCategoryRename(item.label)
                }
                onRemove={loading ? undefined : () => onRemoveCategory(item.label)}
              />
            ),
          )}
        </div>
        <AddRow
          value={newCategoryName}
          placeholder="새 분류 이름 입력 후 Enter..."
          onChange={onNewCategoryNameChange}
          onAdd={onAddCategory}
          disabled={loading}
        />
      </div>
      <div className="mb-5 rounded-[20px] border border-border bg-card p-5 md:p-8">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-fg3 uppercase">동아리 장르</p>
        <p className="mb-4 text-[13px] leading-relaxed text-fg3">
          매뉴얼에 준비 TO-DO가 비어 있으면, 고른 장르의 표준 운영으로 보충합니다. 미리보기에서 지울 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {CLUB_GENRES.map((item) => {
            const selected = genre === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onGenreChange(item.id)}
                className="cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                style={{
                  border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                  background: selected ? "rgba(0,102,255,0.08)" : "var(--bg)",
                  color: selected ? "var(--accent)" : "var(--fg2)",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {firstEvents || secondEvents || failedHalves.length > 0 ? (
        <p className="mb-3 text-[12px] text-fg3">
          상반기 {firstEvents ? `완료 (${firstEvents.length}건)` : failedHalves.includes("first") ? "실패" : "대기"} · 하반기{" "}
          {secondEvents ? `완료 (${secondEvents.length}건)` : failedHalves.includes("second") ? "실패" : "대기"}
        </p>
      ) : null}
      {loading ? <ParseProgressBar value={parseFill} /> : null}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-fg3"
        >
          처음부터
        </button>
        {failedHalves.length === 0 ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => onParse()}
            className="font-display flex-1 cursor-pointer rounded-xl bg-accent py-3 text-[15px] font-bold text-white disabled:opacity-60"
          >
            {loading
              ? parseStep
                ? `${parseStep} 추출 중`
                : "일정 추출 중"
              : "이 팀 구성으로 행사 추출하기 →"}
          </button>
        ) : (
          failedHalves.map((half) => (
            <button
              key={half}
              type="button"
              disabled={loading}
              onClick={() => onParse([half])}
              className="font-display flex-1 cursor-pointer rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading && parseStep
                ? `${parseStep} 추출 중`
                : `${PARSE_HALVES[half].label} 다시 파싱`}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
