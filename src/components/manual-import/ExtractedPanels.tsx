/**
 * 🧭 UniClub - ExtractedPanels (추출 결과 보여주기)
 *
 * 확인 질문 화면에서 "AI가 매뉴얼에서 이런 부서/분류를 뽑았어요"를 보여주는 읽기 전용 패널 두 개를 모아둔 파일입니다.
 *
 * 📌 주요 기능:
 * - ExtractedRolesPanel: 부서 목록과 별칭을 "별칭 → 정식 이름 + 별칭 감지됨" 형태로 보여줍니다.
 * - ExtractedCategoriesPanel: 행사 분류와 각 분류의 별칭을 태그로 보여줍니다.
 * - 목록이 비어 있으면 아무것도 그리지 않습니다.
 *
 * 🔗 사용 예시:
 * ```tsx
 * <ExtractedRolesPanel roles={draftRoles} />
 * <ExtractedCategoriesPanel categories={draftCategories} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - export되는 컴포넌트: ExtractedRolesPanel, ExtractedCategoriesPanel
 * - 의존성: ../marks(RoleChip, Tag), ./utils(extraAliases, extraCategoryAliases)
 *
 * 💡 팁 및 주의사항:
 * - 정식 이름과 같거나 공백뿐인 별칭은 "진짜 별칭"이 아니므로 걸러서 보여줍니다.
 *
 * @file ExtractedPanels.tsx
 * @module components/manual-import/ExtractedPanels
 */
import type { CategoryDefinition, RoleDefinition } from "../../lib/types";
import { RoleChip, Tag } from "../marks";
import { extraAliases, extraCategoryAliases } from "./utils";

/**
 * 매뉴얼에서 추출된 부서(role) 목록과, 각 부서에 딸린 별칭을 "별칭 → 정식 이름" 형태로 보여준다.
 * 특이사항: 별칭이 없는 부서는 이름만 한 줄로, 별칭이 있는 부서는 별칭마다 한 줄씩 "별칭 감지됨"
 * 배지와 함께 늘어놓는다(roles가 비어 있으면 아무것도 렌더링하지 않음).
 */
export function ExtractedRolesPanel({ roles }: { roles: RoleDefinition[] }) {
  if (roles.length === 0) return null;
  const roster = roles.map((role) => role.role_name);
  return (
    <div className="fade-in mb-6 rounded-xl border border-border bg-bg px-4 py-3.5">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">추출된 부서 (별칭 포함)</p>
      <div className="flex flex-col gap-2">
        {roles.flatMap((role) => {
          const aliases = extraAliases(role);
          if (aliases.length === 0) {
            return [
              <div key={role.role_name} className="flex flex-wrap items-center gap-2">
                <RoleChip name={role.role_name} roster={roster} asButton />
              </div>,
            ];
          }
          return aliases.map((alias) => (
            <div key={`${role.role_name}-${alias}`} className="flex flex-wrap items-center gap-2">
              <RoleChip name={alias} roster={roster} accentName={role.role_name} asButton />
              <span className="text-xs text-fg3">→</span>
              <RoleChip name={role.role_name} roster={roster} asButton />
              <span className="rounded-[5px] bg-[rgba(234,179,8,0.1)] px-[7px] py-0.5 text-[11px] font-semibold text-warn">
                별칭 감지됨
              </span>
            </div>
          ));
        })}
      </div>
    </div>
  );
}

/**
 * 매뉴얼에서 추출된 행사 분류(category) 목록과 각 분류의 별칭을 태그 형태로 보여준다.
 * 특이사항: categories가 비어 있으면 아무것도 렌더링하지 않는다.
 */
export function ExtractedCategoriesPanel({ categories }: { categories: CategoryDefinition[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="fade-in mb-6 rounded-xl border border-border bg-bg px-4 py-3.5">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">추출된 행사 분류</p>
      <div className="flex flex-col gap-2">
        {categories.map((category) => {
          const aliases = extraCategoryAliases(category);
          return (
            <div key={category.label} className="flex flex-wrap items-center gap-2">
              <Tag cat={category.label} />
              {aliases.length > 0 ? (
                <span className="text-[12px] text-fg3">별칭 {aliases.join(", ")}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
