import type {
  CategoryDefinition,
  ClarifyingQuestion,
  ClubData,
  ClubProfile,
  RoleDefinition,
} from "../../lib/types";

export type Phase = "input" | "clarifying" | "locked" | "parsed";

export type StartOk = {
  ok: true;
  club_name: string;
  academic_year: number;
  draft_roles: RoleDefinition[];
  draft_categories: CategoryDefinition[];
  questions: ClarifyingQuestion[];
  assistant_message: string;
  text?: string;
};

export type AnswerOk =
  | {
    ok: true;
    status: "clarifying";
    draft_roles: RoleDefinition[];
    draft_categories: CategoryDefinition[];
    questions: ClarifyingQuestion[];
    assistant_message: string;
    turn: number;
  }
  | {
    ok: true;
    status: "locked";
    profile: ClubProfile;
    assistant_message: string;
    turn: number;
  };

export type ParseOk = {
  ok: true;
  data: ClubData;
};

export type ApiError = { ok?: false; error?: string };

export type ParseHalf = "first" | "second";
