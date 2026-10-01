import { MANUAL_IMPORT_DEPTHS, type ManualImportDepth } from "../../lib/types";

/**
 * 입력 단계 첫 화면: AI 추출 깊이(간단형/기본형/체계형)를 고르는 카드 목록.
 */
export function DepthSelectPhase({ onSelect }: { onSelect: (depth: ManualImportDepth) => void }) {
  return (
    <>
      <p className="text-[12px] tracking-widest text-fg3 uppercase">문서 파싱 · 부서표 온보딩</p>
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-lg font-bold text-fg">어떤 식으로 추출해드릴까요?</h2>
        <p className="mt-1 text-sm text-fg3">
          나중에 언제든 바꿀 수 있어요. 매뉴얼이 있든 키워드 몇 줄뿐이든, 다음 단계에서 똑같이 입력할 수 있어요.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[repeat(3,minmax(0,190px))] sm:justify-evenly">
          {MANUAL_IMPORT_DEPTHS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className="my-[30px] flex aspect-square cursor-pointer flex-col items-center rounded-2xl border border-sky-100 bg-sky-50 p-5 text-center transition-colors hover:border-accent"
            >
              <div className="flex flex-1 flex-col items-center justify-center">
                <p className="font-display text-[17px] font-bold text-fg">{option.title}</p>
                <div className="mt-2 flex min-h-[44px] w-full items-center justify-center">
                  <p className="my-[10px] text-[13px] leading-relaxed whitespace-pre-line text-fg3">{option.description}</p>
                </div>
              </div>
              <div className="flex min-h-[32px] w-full items-center justify-center border-t border-sky-100 pt-2">
                <p className="text-[11px] leading-snug text-fg3">{option.recommend}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
