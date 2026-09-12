import { useRef, useState } from "react";

const SAMPLE = [
  { title: "신입부원 모집 공고", category: "모집/홍보", dday: "행사 14일 전", tasks: 4 },
  { title: "면접 진행", category: "모집/홍보", dday: "행사 10일 전", tasks: 4 },
  { title: "워크숍 개최", category: "정기행사", dday: "행사 7일 전", tasks: 5 },
  { title: "재정 결산", category: "재정관리", dday: "월말", tasks: 3 },
  { title: "임원 인수인계", category: "회의/운영", dday: "학기 말 2주 전", tasks: 6 },
];

const STEPS = [
  { label: "문서 로드 중", at: 15 },
  { label: "섹션 구조 파악", at: 35 },
  { label: "행사 일정 추출", at: 55 },
  { label: "D-Day 역산 계산", at: 75 },
  { label: "JSON 스키마 생성", at: 100 },
];

export function AiParsePage() {
  const [phase, setPhase] = useState<"upload" | "parsing" | "result">("upload");
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function startParse() {
    setPhase("parsing");
    setProgress(0);
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          window.clearInterval(timer);
          setPhase("result");
          return 100;
        }
        return value + 12;
      });
    }, 180);
  }

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <p className="mb-6 text-[12px] tracking-widest text-fg3 uppercase">AI 매뉴얼 파싱 엔진</p>

        {phase === "upload" ? (
          <div className="fade-in">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mb-6 w-full cursor-pointer rounded-2xl border-2 border-dashed border-border2 bg-card p-12 text-center hover:border-accent"
            >
              <p className="font-display mb-2 text-lg font-semibold text-fg">운영 매뉴얼 업로드</p>
              <p className="mb-4 text-sm text-fg3">.md · .docx · .pdf 파일 지원</p>
              <div className="flex justify-center gap-2">
                {[".md", ".docx", ".pdf"].map((ext) => (
                  <span key={ext} className="rounded border border-border bg-card2 px-2 py-1 text-[13px] font-semibold text-fg3">
                    {ext}
                  </span>
                ))}
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".md,.docx,.pdf" onChange={startParse} />
            </button>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-xs text-fg3">샘플 파싱 결과 미리보기</p>
              <div className="flex flex-col gap-2">
                {SAMPLE.map((item, index) => (
                  <div key={item.title} className="flex items-center gap-3 rounded bg-card2 p-2 text-xs">
                    <span className="w-4 text-center text-[12px] text-fg3">{index + 1}</span>
                    <span className="font-display flex-1 text-fg">{item.title}</span>
                    <span className="text-[12px] text-fg3">{item.category}</span>
                    <span className="text-[12px] text-accent2">{item.dday}</span>
                    <span className="text-[12px] text-fg3">태스크 {item.tasks}개</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={startParse}
                className="font-display mt-4 w-full cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-white"
              >
                샘플로 파싱 시작
              </button>
            </div>
          </div>
        ) : null}

        {phase === "parsing" ? (
          <div className="fade-in rounded-2xl border border-border bg-card p-8">
            <p className="font-display mb-6 text-lg font-bold text-fg">AI 분석 중...</p>
            <div className="mb-6 h-2 rounded-full bg-border2">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  background: "linear-gradient(90deg, #6366f1, #818cf8)",
                }}
              />
            </div>
            <div className="flex flex-col gap-3">
              {STEPS.map((step, index) => {
                const done = progress >= step.at;
                return (
                  <div key={step.label} className="flex items-center gap-3 text-sm">
                    <div
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs"
                      style={{
                        background: done ? "#22c55e" : "var(--card2)",
                        color: done ? "#fff" : "var(--fg3)",
                      }}
                    >
                      {done ? "✓" : index + 1}
                    </div>
                    <span style={{ color: done ? "var(--fg)" : "var(--fg3)" }}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {phase === "result" ? (
          <div className="fade-in">
            <div className="mb-6 rounded-xl border border-green-300 bg-green-50 p-4">
              <p className="font-display font-semibold text-[#22c55e]">파싱 완료</p>
              <p className="text-xs text-fg3">5개 행사, 22개 태스크 추출됨 · 샘플 미리보기</p>
            </div>
            <div className="mb-4 overflow-hidden rounded-xl border border-border">
              <div className="border-b border-border bg-card2 px-4 py-3 text-[12px] tracking-widest text-fg3 uppercase">
                추출된 JSON 스키마 미리보기
              </div>
              <pre className="overflow-x-auto bg-[#111118] p-4 text-xs text-cyan-200">{`{
  "events": [
    {
      "title": "신입부원 모집 공고",
      "category": "모집/홍보",
      "tasks": [
        { "text": "포스터 디자인", "days_before_dday": 14 },
        { "text": "SNS 홍보글 작성", "days_before_dday": 7 }
      ]
    }
  ]
}`}</pre>
            </div>
            <div className="mb-6 flex flex-col gap-2">
              {SAMPLE.map((item, index) => (
                <div key={item.title} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <span className="w-4 text-center text-xs text-fg3">{index + 1}</span>
                  <div className="flex-1">
                    <p className="font-display text-sm font-medium text-fg">{item.title}</p>
                    <p className="mt-0.5 text-[12px] text-fg3">
                      {item.category} · 기준 {item.dday} · 태스크 {item.tasks}개
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPhase("upload")}
              className="font-display cursor-pointer rounded-lg border border-border bg-card2 px-6 py-2.5 text-sm text-fg2"
            >
              다시 업로드
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
