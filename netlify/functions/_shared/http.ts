export function json(status: number, payload: unknown): Response {
  return Response.json(payload, { status });
}

export function errorResponse(message: string, status = 500): Response {
  return json(status, { ok: false, error: message });
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
