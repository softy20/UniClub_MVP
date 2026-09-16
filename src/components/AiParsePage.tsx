import type { ClubData } from "../lib/types";
import { ManualImportWizard } from "./ManualImportWizard";

type AiParsePageProps = {
  onApply: (data: ClubData) => void;
};

export function AiParsePage({ onApply }: AiParsePageProps) {
  return <ManualImportWizard onApply={onApply} />;
}
