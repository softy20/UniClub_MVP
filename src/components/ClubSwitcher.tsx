/**
 * 🧭 UniClub - ClubSwitcher
 *
 * 헤더에서 지금 보고 있는 동아리를 보여주고, 내가 속한 다른 동아리로 전환하거나
 * 새 동아리를 만들거나, 초대 링크를 만들어 복사할 수 있게 해주는 작은 부품입니다.
 * SeasonSwitcher와 같은 구조를 따릅니다.
 *
 * 📌 주요 기능:
 * - 드롭다운으로 내가 속한 동아리 중 하나를 골라 전환
 * - "새 동아리" 버튼으로 동아리 이름을 입력해서 생성 + 자동 전환
 * - "초대 링크" 버튼으로 지금 동아리의 초대 링크를 만들어 클립보드에 복사
 *
 * @file ClubSwitcher.tsx
 * @module components/ClubSwitcher
 */
import { useState } from "react";
import { Plus, Link as LinkIcon } from "@phosphor-icons/react";
import type { ClubSummary } from "../lib/types";

type ClubSwitcherProps = {
  clubs: ClubSummary[];
  activeClubId: string;
  onSwitch: (clubId: string) => void;
  onCreateClub: (name: string) => Promise<string>;
  onCreateInvite: (clubId: string) => Promise<string>;
};

export function ClubSwitcher({ clubs, activeClubId, onSwitch, onCreateClub, onCreateInvite }: ClubSwitcherProps) {
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "working" | "copied" | "error">("idle");

  function startAdding() {
    setDraftName("");
    setAdding(true);
  }

  async function submitNewClub() {
    const name = draftName.trim();
    if (!name) return;
    const clubId = await onCreateClub(name);
    onSwitch(clubId);
    setAdding(false);
  }

  async function copyInviteLink() {
    setInviteStatus("working");
    try {
      const token = await onCreateInvite(activeClubId);
      const url = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(url);
      setInviteStatus("copied");
    } catch (error) {
      console.error("초대 링크 생성 실패", error);
      setInviteStatus("error");
    } finally {
      setTimeout(() => setInviteStatus("idle"), 2000);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor="club-switcher">
        동아리 선택
      </label>
      <select
        id="club-switcher"
        value={activeClubId}
        onChange={(event) => onSwitch(event.target.value)}
        aria-label="동아리 전환"
        className="tabular cursor-pointer rounded-md border border-border bg-transparent px-1.5 py-0.5 text-[12px] font-medium text-fg3 outline-none"
      >
        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
          </option>
        ))}
      </select>

      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitNewClub();
              if (event.key === "Escape") setAdding(false);
            }}
            placeholder="동아리 이름"
            aria-label="새 동아리 이름"
            className="w-28 rounded-md border border-accent bg-bg px-1.5 py-0.5 text-[12px] text-fg outline-none"
          />
          <button
            type="button"
            onClick={submitNewClub}
            className="cursor-pointer rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-accent"
          >
            만들기
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
        <>
          <button
            type="button"
            onClick={startAdding}
            aria-label="새 동아리 만들기"
            className="flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-fg3 transition-colors duration-150 hover:bg-card2"
          >
            <Plus size={11} weight="bold" aria-hidden="true" />새 동아리
          </button>
          <button
            type="button"
            onClick={copyInviteLink}
            disabled={inviteStatus === "working"}
            aria-label="초대 링크 복사"
            className="flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-fg3 transition-colors duration-150 hover:bg-card2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LinkIcon size={11} weight="bold" aria-hidden="true" />
            {inviteStatus === "copied" ? "복사됨!" : inviteStatus === "error" ? "실패" : "초대 링크"}
          </button>
        </>
      )}
    </div>
  );
}
