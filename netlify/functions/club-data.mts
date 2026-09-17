import { getStore } from "@netlify/blobs";
import { errorResponse, json, readJsonBody } from "./_shared/http.ts";
import { coerceClubData } from "./_shared/schema.ts";

const STORE_NAME = "club-data";
const KEY = "default";

export default async (req: Request) => {
  const store = getStore(STORE_NAME);

  if (req.method === "GET") {
    try {
      const data = await store.get(KEY, { type: "json" });
      return json(200, { ok: true, data: data ?? null });
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
      await store.setJSON(KEY, data);
      return json(200, { ok: true });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  return errorResponse("Method not allowed", 405);
};
