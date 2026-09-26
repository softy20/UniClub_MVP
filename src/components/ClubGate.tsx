/**
 * 🧭 UniClub - ClubGate
 *
 * 로그인은 끝났지만 아직 "어느 동아리를 볼지"가 정해지지 않은 사람을 위한 화면입니다.
 * main.tsx에서 로그인 확인 후 App 대신 이 컴포넌트를 렌더링합니다.
 *
 * 📌 주요 기능:
 * - 주소가 "/invite/토큰"이면, 로그인된 계정으로 그 초대를 자동으로 사용(가입)합니다.
 * - 내가 속한 동아리 목록을 불러와서, 마지막으로 보던 동아리(브라우저 저장) 또는
 *   목록의 첫 동아리를 활성 동아리로 고릅니다.
 * - 속한 동아리가 하나도 없으면(초대 처리 중이 아닐 때) 동아리를 새로 만드는 화면을 보여줍니다.
 * - 활성 동아리가 정해지면 App을 렌더링하고, 동아리 전환/생성/초대 관련 함수를 내려줍니다.
 *
 * 💡 팁 및 주의사항:
 * - 라우터 없이 window.location.pathname만 직접 읽고, 초대 처리가 끝나면
 *   history.replaceState로 주소를 "/"로 정리합니다.
 *
 * @file ClubGate.tsx
 * @module components/ClubGate
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import App from "../App";
import { useClubs } from "../hooks/useClubs";

type ClubGateProps = {
  session: Session;
  onSignOut: () => void;
};

const ACTIVE_CLUB_KEY_PREFIX = "uniclub-active-club";

/**
 * 현재 주소(pathname)가 "/invite/토큰" 형태인지 확인하고, 맞다면 토큰 값을 뽑아냅니다.
 * @returns 초대 토큰 문자열, 초대 주소가 아니면 null
 */
function readInviteTokenFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

/**
 * 로그인은 됐지만 활성 동아리가 아직 정해지지 않은 사용자를 위한 게이트 컴포넌트.
 * 초대 링크 자동 처리, 마지막으로 보던 동아리 복원, 동아리 없을 때 생성 화면 표시,
 * 활성 동아리가 정해지면 App 렌더링까지 이어지는 흐름을 관리합니다.
 * 특이사항: activeClubId가 정해지기 전까지는 App을 그리지 않고 로딩/생성 화면만 보여줍니다.
 */
export function ClubGate({ session, onSignOut }: ClubGateProps) {
  const userId = session.user.id;
  const { clubs, loading, createClub, createInvite, redeemInvite } = useClubs(userId);
  const [pendingInvite] = useState(() => readInviteTokenFromUrl());
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(pendingInvite !== null);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const storageKey = useMemo(() => `${ACTIVE_CLUB_KEY_PREFIX}:${userId}`, [userId]);

  // 주소에 초대 토큰이 있으면 자동으로 초대를 사용(가입)하고, 성공/실패와 관계없이
  // 주소는 "/"로 정리한다. 언마운트 시 상태 갱신을 막기 위해 cancelled 플래그를 둔다.
  useEffect(() => {
    if (!pendingInvite) return;
    let cancelled = false;
    redeemInvite(pendingInvite)
      .then((clubId) => {
        if (cancelled) return;
        window.history.replaceState(null, "", "/");
        setActiveClubId(clubId);
      })
      .catch((error) => {
        if (cancelled) return;
        window.history.replaceState(null, "", "/");
        setInviteError(error instanceof Error ? error.message : "초대 링크를 사용할 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setRedeeming(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite]);

  // 동아리 목록이 준비되면, 저장해둔 마지막 활성 동아리가 아직도 소속되어 있는지 확인하고
  // 있으면 그걸, 없으면 목록의 첫 동아리를 활성 동아리로 정한다.
  useEffect(() => {
    if (activeClubId || loading || clubs.length === 0) return;
    const saved = localStorage.getItem(storageKey);
    const stillMember = saved && clubs.some((club) => club.id === saved);
    setActiveClubId(stillMember ? saved : clubs[0].id);
  }, [activeClubId, loading, clubs, storageKey]);

  /**
   * 활성 동아리를 바꾸고, 다음 방문 때도 이어서 쓸 수 있도록 브라우저에 저장합니다.
   * @param clubId - 새로 활성화할 동아리 id
   */
  function switchClub(clubId: string) {
    setActiveClubId(clubId);
    localStorage.setItem(storageKey, clubId);
  }

  /**
   * 동아리 생성 폼 제출을 처리합니다: 입력된 이름으로 동아리를 만들고, 성공하면
   * 그 동아리로 바로 전환합니다.
   * 특이사항: 이름이 빈 문자열(공백 제거 후)이면 아무 것도 하지 않고 조용히 종료합니다.
   */
  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const clubId = await createClub(name);
      switchClub(clubId);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "동아리 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  if (loading || redeeming) return null;

  if (!activeClubId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm rounded-[20px] border border-border bg-card p-8">
          <h1 className="font-display text-lg font-bold text-fg">동아리가 아직 없어요</h1>
          <p className="mt-1 text-[13px] text-fg3">
            새 동아리를 만들거나, 다른 임원에게 받은 초대 링크로 접속해 주세요.
          </p>
          {inviteError ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {inviteError}
            </p>
          ) : null}
          <form onSubmit={handleCreateSubmit} className="mt-6 flex flex-col gap-3">
            <input
              autoFocus
              required
              placeholder="동아리 이름"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="rounded-[10px] border-[1.5px] border-border bg-bg px-3.5 py-[9px] text-[13px] text-fg outline-none"
            />
            {createError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={creating}
              className="font-display mt-1 w-full cursor-pointer rounded-[10px] bg-accent py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              동아리 만들기
            </button>
          </form>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-4 w-full cursor-pointer text-center text-[13px] font-medium text-fg3"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <App
      clubId={activeClubId}
      clubs={clubs}
      accessToken={session.access_token}
      onSwitchClub={switchClub}
      onCreateClub={createClub}
      onCreateInvite={createInvite}
      onSignOut={onSignOut}
      userEmail={session.user.email ?? null}
    />
  );
}
