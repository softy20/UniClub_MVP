import { getStore, type Store } from "@netlify/blobs";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import { coerceClubData } from "./_shared/schema.ts";
import { getRequestUser, isClubMember } from "./_shared/supabaseClient.ts";

const STORE_NAME = "club-data";
// 콜론(:)은 피한다 - Windows에서 netlify dev(로컬 블롭 서버)가 콜론을 파일명으로 쓸 때
// percent-encoding만 하고 list() 결과에서 다시 decoding하지 않아, 로컬 개발 중에는
// list()가 이 키들을 못 찾는 문제가 있다. 하이픈은 인코딩이 아예 필요 없어 안전하다.
function seasonKeyPrefix(clubId: string): string {
  return `club-${clubId}-season-`;
}

function seasonKey(clubId: string, year: number): string {
  return `${seasonKeyPrefix(clubId)}${year}`;
}

/**
 * 이 동아리(clubId)에 저장된 시즌(학년도) 키들을 blob store에서 나열해 오름차순 연도
 * 배열로 반환한다.
 */
async function listSeasonYears(store: Store, clubId: string): Promise<number[]> {
  const prefix = seasonKeyPrefix(clubId);
  const { blobs } = await store.list({ prefix });
  return blobs
    .map((blob) => Number(blob.key.slice(prefix.length)))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
}

/**
 * 동아리별 연간 데이터(ClubData)를 조회/저장하는 Netlify 함수 핸들러.
 * GET은 club/season 쿼리로 특정 학년도(생략 시 최신) 데이터와 저장된 시즌 목록을
 * 반환하고, POST는 본문의 ClubData를 검증한 뒤 해당 학년도 키로 저장한다.
 * 특이사항: 로그인 및 club_members 소속 확인(isClubMember)을 통과해야만 접근을 허용한다.
 */
export default async (req: Request) => {
  const auth = await getRequestUser(req);
  if (!auth) return errorResponse("로그인이 필요합니다.", 401);

  const url = new URL(req.url);
  const clubId = url.searchParams.get("club");
  if (!clubId) return errorResponse("club 파라미터가 필요합니다.", 400);

  const member = await isClubMember(auth.client, clubId, auth.user.id);
  if (!member) return errorResponse("이 동아리에 접근할 권한이 없습니다.", 403);

  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    try {
      const seasons = await listSeasonYears(store, clubId);
      const requestedRaw = url.searchParams.get("season");
      const year = requestedRaw !== null ? Number(requestedRaw) : (seasons.at(-1) ?? null);
      const data = year !== null && Number.isFinite(year) ? await store.get(seasonKey(clubId, year), { type: "json" }) : null;
      return json(200, { ok: true, data: data ?? null, seasons });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await readJsonBody<unknown>(req);
    } catch {
      return errorResponse("잘못된 요청 본문입니다.", 400);
    }
    const data = coerceClubData(body);
    if (!data) {
      return errorResponse("클럽 데이터 형식이 올바르지 않습니다.", 400);
    }
    try {
      await store.setJSON(seasonKey(clubId, data.club_info.academic_year), data);
      return json(200, { ok: true });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  return errorResponse("Method not allowed", 405);
};
