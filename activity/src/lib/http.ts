export class HttpError extends Error {
  constructor(readonly status: number, path: string) {
    super(`${path} → ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new HttpError(response.status, path);
  return response.json() as Promise<T>;
}

export const getJson = <T>(path: string, accessToken?: string) =>
  request<T>(path, accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined);

export const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
