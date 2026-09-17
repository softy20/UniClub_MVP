import { getStore, type Store } from "@netlify/blobs";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import { coerceClubData } from "./_shared/schema.ts";

const STORE_NAME = "club-data";
const LEGACY_KEY = "default";
// 콜론(:)은 피한다 - Windows에서 netlify dev(로컬 블롭 서버)가 콜론을 파일명으로 쓸 때
// percent-encoding만 하고 list() 결과에서 다시 decoding하지 않아, 로컬 개발 중에는
// list()가 이 키들을 못 찾는 문제가 있다. 하이픈은 인코딩이 아예 필요 없어 안전하다.
const SEASON_PREFIX = "season-";

function seasonKey(year: number): string {
  return `${SEASON_PREFIX}${year}`;
}

async function listSeasonYears(store: Store): Promise<number[]> {
  const { blobs } = await store.list({ prefix: SEASON_PREFIX });
  return blobs
    .map((blob) => Number(blob.key.slice(SEASON_PREFIX.length)))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
}

// 예전에는 club-data 전체가 "default" 키 하나에만 저장됐다. 그 데이터를 학년도(academic_year)
// 기준 시즌 키로 한 번 옮겨두고, "default" 키는 지워서 다음 요청부터는 건너뛴다.
async function migrateLegacyDefault(store: Store): Promise<void> {
  const legacy = await store.get(LEGACY_KEY, { type: "json" });
  if (legacy === null) return;
  const data = coerceClubData(legacy);
  if (data) {
    const key = seasonKey(data.club_info.academic_year);
    const existing = await store.get(key, { type: "json" });
    if (existing === null) await store.setJSON(key, data);
  }
  await store.delete(LEGACY_KEY);
}

export default async (req: Request) => {
  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    try {
      await migrateLegacyDefault(store);
      const seasons = await listSeasonYears(store);
      const url = new URL(req.url);
      const requestedRaw = url.searchParams.get("season");
      const year = requestedRaw !== null ? Number(requestedRaw) : (seasons.at(-1) ?? null);
      const data = year !== null && Number.isFinite(year) ? await store.get(seasonKey(year), { type: "json" }) : null;
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
      await store.setJSON(seasonKey(data.club_info.academic_year), data);
      return json(200, { ok: true });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  return errorResponse("Method not allowed", 405);
};
