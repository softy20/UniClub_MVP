/**
 * 🧭 UniClub - DashboardPage
 *
 * 동아리 운영 현황을 한눈에 보여주는 대시보드 화면입니다.
 * 전체 행사 수, 완료된 할 일 개수, 임박한 행사, 전체 행사 목록을 정리해서 보여줍니다.
 *
 * 📌 주요 기능:
 * - 전체 행사 수 / 완료 태스크 비율 / D-7 이내 임박 행사 수 / 임원 수를 카드 형태 통계로 표시
 * - D-7 이내로 다가온 "긴급 행사" 목록을 남은 일수 순으로 정렬해서 보여줌
 * - 각 임박 행사의 체크리스트 진행률과 아직 안 끝난 할 일 일부를 미리보기로 표시
 * - 전체 행사를 날짜순 표 형태로 정리해서 보여주고, 행을 클릭하면 상세 패널을 열 수 있음
 *
 * 🔗 사용 예시:
 * ```tsx
 * // 이 컴포넌트는 App.tsx 같은 상위 화면에서 아래처럼 사용합니다.
 * <DashboardPage events={events} officerCount={5} onSelect={(event) => openPanel(event)} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): events(행사 목록), officerCount(임원 수), onSelect(행사를 눌렀을 때 실행할 함수)
 * - 컴포넌트 안에서 바뀌는 데이터(State): 없음 (전달받은 events로 매번 새로 계산만 함)
 * - 이 파일이 내보내는 것: DashboardPage 컴포넌트
 *
 * 💡 팁 및 주의사항:
 * - 통계 값(완료율, 긴급 행사 수 등)은 매 렌더링마다 events 배열을 다시 계산해서 만듭니다. 별도로 저장해두지 않습니다.
 * - 행사나 할 일 데이터 자체를 수정하는 기능은 없고, 클릭 시 onSelect로 알려주기만 합니다.
 *
 * @file DashboardPage.tsx
 * @module components/DashboardPage
 */
import type { OpsEvent } from "../lib/ops";
import { DdayBadge, Tag } from "./marks";

type DashboardPageProps = {
  events: OpsEvent[];
  officerCount: number;
  onSelect: (event: OpsEvent) => void;
};

export function DashboardPage({ events, officerCount, onSelect }: DashboardPageProps) {
  const urgent = events
    .filter((event) => event.daysLeft >= 0 && event.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const totalTasks = events.reduce((sum, event) => sum + event.checklist.length, 0);
  const doneTasks = events.reduce((sum, event) => sum + event.checklist.filter((item) => item.done).length, 0);
  const overallPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  const stats = [
    { label: "전체 행사", value: String(events.length), sub: "이번 학년도", color: "#6366f1" },
    { label: "완료 태스크", value: `${doneTasks}/${totalTasks}`, sub: `전체 ${overallPct}%`, color: "#22c55e" },
    { label: "D-7 이내", value: String(urgent.length), sub: "긴급 처리 필요", color: "#ef4444" },
    { label: "임원 수", value: `${officerCount}명`, sub: "역할 기준", color: "#f97316" },
  ];

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-[13px] tracking-widest text-fg3 uppercase">{stat.label}</p>
            <p className="font-display mb-1 text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="text-xs text-fg3">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <p className="mb-4 flex items-center gap-2 text-[12px] tracking-widest text-fg3 uppercase">
          <span className="pulse-dot inline-block size-1.5 rounded-full bg-red-500" />
          D-7 긴급 행사
        </p>
        <div className="flex flex-col gap-2">
          {urgent.map((event) => {
            const done = event.checklist.filter((item) => item.done).length;
            const pct = event.checklist.length === 0 ? 0 : Math.round((done / event.checklist.length) * 100);
            const remaining = event.checklist.filter((item) => !item.done);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelect(event)}
                className="cursor-pointer rounded-xl border border-border bg-card p-4 text-left transition-all hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <DdayBadge dday={event.dday} />
                      <Tag cat={event.category} />
                    </div>
                    <p className="font-display font-semibold text-fg">{event.title}</p>
                    <p className="mt-1 text-xs text-fg3">
                      {event.date.getMonth() + 1}월 {event.date.getDate()}일
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                    {remaining.length > 0 ? (
                      <div className="mt-2 flex flex-col gap-1">
                        {remaining.slice(0, 2).map((item) => (
                          <p key={item.id} className="flex items-center gap-1.5 text-xs text-fg2">
                            <span className="text-[#ef4444]">○</span> {item.text}
                          </p>
                        ))}
                        {remaining.length > 2 ? <p className="text-xs text-fg3">+{remaining.length - 2}개 남음</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="mb-1 text-xs text-fg3">{pct}%</div>
                    <div className="h-1 w-16 rounded-full bg-border2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#6366f1" }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {urgent.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="font-display text-sm text-fg3">D-7 이내 긴급 행사 없음</p>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-4 text-[12px] tracking-widest text-fg3 uppercase">전체 행사 목록</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card2">
                {["행사명", "날짜", "카테고리", "D-Day", "진행률", ""].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-[12px] font-medium tracking-widest text-fg3 uppercase">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...events]
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map((event, index) => {
                  const done = event.checklist.filter((item) => item.done).length;
                  const pct = event.checklist.length === 0 ? 0 : Math.round((done / event.checklist.length) * 100);
                  return (
                    <tr
                      key={event.id}
                      className="cursor-pointer bg-card hover:bg-card2"
                      style={{ borderBottom: index < events.length - 1 ? "1px solid var(--border)" : "none" }}
                      onClick={() => onSelect(event)}
                    >
                      <td className="font-display px-4 py-3 font-medium text-fg">{event.title}</td>
                      <td className="px-4 py-3 text-xs text-fg3">
                        {event.date.getMonth() + 1}월 {event.date.getDate()}일
                      </td>
                      <td className="px-4 py-3">
                        <Tag cat={event.category} />
                      </td>
                      <td className="px-4 py-3">
                        <DdayBadge dday={event.dday} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-20 rounded-full bg-border2">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#6366f1" }}
                            />
                          </div>
                          <span className="text-xs text-fg3">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-fg3">›</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
