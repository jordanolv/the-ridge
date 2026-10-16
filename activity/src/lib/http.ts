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

const authorization = (accessToken?: string): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {});

export const getJson = <T>(path: string, accessToken?: string) => request<T>(path, { headers: authorization(accessToken) });

export const postJson = <T>(path: string, body: unknown, accessToken?: string) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authorization(accessToken) }, body: JSON.stringify(body) });
