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
