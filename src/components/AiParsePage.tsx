/**
 * 🧭 UniClub - AiParsePage
 *
 * 동아리 자료(공지, 일정 등)를 불러와서 앱에 등록하는 화면입니다.
 * 실제 화면 내용은 ManualImportWizard 컴포넌트가 담당하고, 이 파일은 그것을 감싸서 보여주는 껍데기 역할만 합니다.
 *
 * 📌 주요 기능:
 * - ManualImportWizard 컴포넌트를 화면에 띄움
 * - 마법사(Wizard)에서 데이터 등록이 끝나면 그 결과를 상위 화면으로 그대로 전달
 *
 * 🔗 사용 예시:
 * ```tsx
 * // App.tsx에서 데이터 가져오기 탭으로 사용합니다.
 * <AiParsePage onApply={(data) => setClubData(data)} />
 * ```
 *
 * 🎯 주요 관리 요소:
 * - 외부에서 전달받는 데이터(Props): onApply(가져온 동아리 데이터를 적용할 때 실행할 함수)
 * - 컴포넌트 안에서 바뀌는 데이터(State): 없음
 * - 이 파일이 내보내는 것: AiParsePage 컴포넌트
 *
 * 💡 팁 및 주의사항:
 * - 이 파일 자체에는 로직이 거의 없습니다. 실제 동작을 확인하려면 ManualImportWizard.tsx 파일을 함께 봐야 합니다.
 *
 * @file AiParsePage.tsx
 * @module components/AiParsePage
 */
import type { ClubData } from "../lib/types";
import { ManualImportWizard } from "./ManualImportWizard";

type AiParsePageProps = {
  onApply: (data: ClubData) => void;
};

export function AiParsePage({ onApply }: AiParsePageProps) {
  return <ManualImportWizard onApply={onApply} />;
}
