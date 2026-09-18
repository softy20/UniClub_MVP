/**
 * 🧭 UniClub - SettingsPage (설정 탭)
 *
 * 사이드바 톱니바퀴 아이콘으로 들어오는 설정 화면입니다. 게스트(비로그인) 모드에서는
 * 이 기기에 임시로 쌓인 동아리 데이터를 확인하고 지울 수 있고, 로그인 화면으로 돌아갈 수
 * 있습니다. 로그인한 사용자에게는 계정 정보와 로그아웃 버튼을 보여줍니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * <SettingsPage isGuest data={data} onClearGuestData={() => ...} onSignOut={signOut} />
 * ```
 *
 * @file SettingsPage.tsx
 * @module components/SettingsPage
 */
import { useState } from "react";
import type { ClubData } from "../lib/types";

type SettingsPageProps = {
  isGuest: boolean;
  userEmail?: string | null;
  data: ClubData;
  seasons: number[];
  onClearGuestData: () => void;
  onSignOut: () => void;
};

export function SettingsPage({ isGuest, userEmail, data, seasons, onClearGuestData, onSignOut }: SettingsPageProps) {
  const [confirming, setConfirming] = useState(false);

  function handleClear() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onClearGuestData();
    setConfirming(false);
  }

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-[620px] flex-col gap-4">
        <p className="text-[12px] tracking-widest text-fg3 uppercase">설정</p>

        {isGuest ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-1 text-sm font-semibold text-fg">현재 비로그인(게스트) 상태입니다</p>
            <p className="text-[13px] leading-relaxed text-fg3">
              지금 보고 있는 데이터는 이 브라우저에만 저장되어 있어요. 다른 기기에서는 보이지 않고,
              브라우저 저장공간을 지우면 함께 사라져요. 계속 쓰려면 로그인해서 계정에 보존하세요.
            </p>
            <button
              type="button"
              onClick={onSignOut}
              className="font-display mt-4 w-full cursor-pointer rounded-[10px] bg-accent py-2.5 text-sm font-semibold text-white"
            >
              로그인하기
            </button>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-1 text-sm font-semibold text-fg">로그인됨</p>
            {userEmail ? <p className="text-[13px] text-fg3">{userEmail}</p> : null}
            <button
              type="button"
              onClick={onSignOut}
              className="mt-4 w-full cursor-pointer rounded-[10px] border border-border bg-card2 py-2.5 text-sm font-semibold text-fg2"
            >
              로그아웃
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">저장된 데이터</p>
          <div className="flex flex-col gap-1.5 text-[13px] text-fg2">
            <p>
              동아리 이름 <span className="font-semibold text-fg">{data.club_info.club_name}</span>
            </p>
            <p>
              학년도 <span className="font-semibold text-fg">{data.club_info.academic_year}</span>
              {seasons.length > 1 ? ` · 총 ${seasons.length}개 시즌` : ""}
            </p>
            <p>
              행사 <span className="font-semibold text-fg">{data.events.length}건</span>
            </p>
          </div>
        </section>

        {isGuest ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="mb-1 text-sm font-semibold text-red-700">게스트 데이터 초기화</p>
            <p className="mb-4 text-[13px] leading-relaxed text-red-700/80">
              이 기기에 저장된 게스트 동아리 데이터를 모두 지웁니다. 되돌릴 수 없어요.
            </p>
            <button
              type="button"
              onClick={handleClear}
              className="cursor-pointer rounded-[10px] border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700"
            >
              {confirming ? "정말로 지울까요? 다시 눌러 확정" : "게스트 데이터 초기화"}
            </button>
            {confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="ml-2 cursor-pointer rounded-[10px] px-4 py-2 text-sm font-semibold text-fg3"
              >
                취소
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
