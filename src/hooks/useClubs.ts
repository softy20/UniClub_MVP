/**
 * 🧭 UniClub - useClubs
 *
 * 로그인한 사용자가 속한 동아리 목록을 가져오고, 새 동아리를 만들거나
 * 초대 링크를 발급/사용하는 재사용 로직 묶음입니다.
 *
 * 📌 주요 기능:
 * - 내가 속한 동아리 목록(clubs)을 Supabase에서 불러옵니다.
 * - createClub: 새 동아리를 만들고 나를 owner로 등록합니다.
 * - createInvite: 특정 동아리의 초대 토큰을 발급받습니다.
 * - redeemInvite: 초대 토큰으로 그 동아리의 member가 됩니다.
 *
 * 💡 팁 및 주의사항:
 * - 실제 생성/가입 로직은 Supabase Postgres에 정의된 SECURITY DEFINER 함수
 *   (create_club, create_invite, redeem_invite)가 처리합니다. 이 훅은 그 함수들을
 *   호출(rpc)하고 결과를 화면 상태에 반영하는 역할만 합니다.
 *
 * @file useClubs.ts
 * @module hooks/useClubs
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { ClubSummary } from "../lib/types";

type ClubMemberRow = {
  role: "owner" | "member";
  clubs: { id: string; name: string } | null;
};

/**
 * 로그인한 사용자가 속한 동아리 목록을 불러오고, 동아리 생성/초대 발급/초대 사용 기능을 제공하는 훅.
 * @param userId - 목록을 조회할 사용자 id. 바뀌면 목록을 다시 불러온다.
 * @returns clubs, loading과 refresh/createClub/createInvite/redeemInvite 함수
 */
export function useClubs(userId: string) {
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 사용자가 속한 동아리 목록을 Supabase에서 다시 조회해 clubs 상태를 갱신한다.
   * 특이사항: clubs 관계가 null인 행(탈퇴 등으로 끊어진 멤버십)은 걸러낸다.
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("club_members")
      .select("role, clubs(id, name)")
      .eq("user_id", userId);
    if (!error && data) {
      const rows = data as unknown as ClubMemberRow[];
      setClubs(
        rows
          .filter((row) => row.clubs !== null)
          .map((row) => ({ id: row.clubs!.id, name: row.clubs!.name, role: row.role })),
      );
    } else if (error) {
      console.error("동아리 목록 조회 실패", error);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * 새 동아리를 생성하고 나를 owner로 등록한다.
   * 특이사항: 실제 생성 로직은 Supabase의 SECURITY DEFINER 함수 create_club이 처리하며,
   * 성공 후 목록을 새로고침(refresh)한다.
   */
  async function createClub(name: string): Promise<string> {
    const { data, error } = await supabase.rpc("create_club", { p_name: name });
    if (error) throw new Error(error.message);
    await refresh();
    return data as string;
  }

  /** 특정 동아리의 초대 토큰을 발급받는다(create_invite RPC 호출). */
  async function createInvite(clubId: string): Promise<string> {
    const { data, error } = await supabase.rpc("create_invite", { p_club_id: clubId });
    if (error) throw new Error(error.message);
    return data as string;
  }

  /**
   * 초대 토큰을 사용해 해당 동아리의 member가 된다.
   * 특이사항: redeem_invite RPC 호출 성공 후 목록을 새로고침(refresh)한다.
   */
  async function redeemInvite(token: string): Promise<string> {
    const { data, error } = await supabase.rpc("redeem_invite", { p_token: token });
    if (error) throw new Error(error.message);
    await refresh();
    return data as string;
  }

  return { clubs, loading, refresh, createClub, createInvite, redeemInvite };
}
