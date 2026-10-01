/**
 * 🧭 UniClub - LandingPage (첫 소개 화면)
 *
 * 로그인하기 전, 사이트에 처음 들어왔을 때 가장 먼저 보여주는 소개 화면입니다.
 * 로그인 화면으로 바로 넘어가지 않고, UniClub이 뭘 도와주는 앱인지 한 번 보여준 뒤
 * "시작하기"(로그인/회원가입)나 "로그인 없이 둘러보기"(게스트) 중 하나를 고르게 합니다.
 *
 * 📌 주요 기능:
 * - 앱 이름과 한 줄 소개, 두 개의 시작 버튼(시작하기 / 로그인 없이 둘러보기)을 보여줍니다.
 * - 사이드바 메뉴 4개(대시보드/캘린더/할 일 목록/AI 일정 추출)를 카드로 소개합니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * <LandingPage onStart={() => setView("auth")} onGuestMode={() => setGuest(true)} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - Props onStart: "시작하기" 버튼을 눌렀을 때 실행할 함수(로그인 화면으로 이동)
 * - Props onGuestMode: "로그인 없이 둘러보기" 버튼을 눌렀을 때 실행할 함수(게스트로 진입)
 * - 내부 상수 FEATURES: 소개 카드 4개의 아이콘·제목·설명(Sidebar.tsx의 메뉴 구성과 맞춰둠)
 *
 * 💡 팁 및 주의사항:
 * - 실제 로그인/게스트 판단은 이 컴포넌트 밖(main.tsx)에서 하고, 여기는 화면만 담당합니다.
 * - 메뉴가 바뀌면(Sidebar.tsx의 NAV) 이 화면의 FEATURES도 같이 맞춰줘야 합니다.
 *
 * @file LandingPage.tsx
 * @module components/LandingPage
 */
import { CalendarBlank, CheckSquare, Lightning, SquaresFour } from "@phosphor-icons/react";

type LandingPageProps = {
  onStart: () => void;
  onGuestMode: () => void;
};

const FEATURES = [
  {
    icon: SquaresFour,
    title: "대시보드",
    description: "전체 행사 수, 완료 태스크, D-7 이내 긴급 할 일을 숫자로 한눈에 봅니다.",
  },
  {
    icon: CalendarBlank,
    title: "캘린더",
    description: "학기 전체 행사를 월별 달력에서 카테고리별로 필터링해서 봅니다.",
  },
  {
    icon: CheckSquare,
    title: "할 일 목록",
    description: "행사마다 딸린 할 일을 부서별로 묶어서 체크만 하면 됩니다.",
  },
  {
    icon: Lightning,
    title: "AI 일정 추출",
    description: "운영 매뉴얼(md/docx/pdf)만 올리면 연간 일정 초안을 뽑아드립니다.",
  },
] as const;

// 로그인 전, 앱을 소개하고 시작하기/둘러보기 중 하나를 고르게 하는 첫 화면
export function LandingPage({ onStart, onGuestMode }: LandingPageProps) {
  return (
    <div className="fade-in min-h-[100dvh] bg-bg">
      <header className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 pt-6 sm:px-6">
        <div
          className="font-display flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
        >
          U
        </div>
        <span className="font-display text-base font-bold text-fg">UniClub</span>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
        <h1 className="font-display text-[28px] leading-tight font-extrabold text-fg sm:text-[40px]">
          동아리 임원 업무, <br className="sm:hidden" />
          UniClub 하나로
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg2 sm:text-base">
          행사 일정과 부서별 할 일을 한 곳에서 관리하고, 운영 매뉴얼만 올리면 AI가 연간 일정
          초안까지 뽑아드려요.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5 sm:flex-row sm:max-w-none sm:justify-center">
          <button
            type="button"
            onClick={onStart}
            className="font-display cursor-pointer rounded-[10px] bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent2"
          >
            시작하기
          </button>
          <button
            type="button"
            onClick={onGuestMode}
            className="cursor-pointer rounded-[10px] border border-border bg-card px-6 py-3 text-sm font-semibold text-fg2 transition-colors duration-150 hover:bg-card2"
          >
            로그인 없이 둘러보기
          </button>
        </div>

        <div className="mt-16 grid w-full grid-cols-1 gap-3 text-left sm:mt-20 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-card2 text-accent2">
                  <Icon size={20} weight="bold" aria-hidden="true" />
                </div>
                <p className="font-display mb-1 text-sm font-bold text-fg">{feature.title}</p>
                <p className="text-[13px] leading-relaxed text-fg3">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="pb-8 text-center text-[12px] text-fg3">UniClub MVP v0.1</footer>
    </div>
  );
}
