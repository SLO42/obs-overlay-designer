import { HELIX_BASE_URL } from "./config";

export interface HelixClient {
  get<T>(path: string, query?: Record<string, string | number | boolean>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete(path: string): Promise<void>;
}

export class HelixError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: unknown,
  ) {
    super(`Helix ${status} at ${url}`);
    this.name = "HelixError";
  }
}

interface CreateHelixClientOptions {
  clientId: string;
  token: string;
  /** Override for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests — defaults to `https://api.twitch.tv/helix`. */
  baseUrl?: string;
}

/**
 * Resolve a path/query combination into a fully-qualified URL. Accepts
 * leading slashes on `path`. Query values are stringified; booleans become
 * literal "true"/"false".
 */
function buildUrl(baseUrl: string, path: string, query?: Record<string, unknown>): string {
  const url = new URL((path.startsWith("/") ? path : `/${path}`).replace(/^\/+/, "/"), baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.append(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Thin typed wrapper around Twitch Helix. No retry logic — callers handle
 * backoff when needed (rate limits are well outside the 429 you'd see from
 * an OBS overlay that creates 5-6 subscriptions on connect).
 *
 * All responses are JSON; `delete` swallows the body and just checks the
 * status. Non-2xx bubbles a typed `HelixError` with the parsed body for
 * diagnostics.
 */
export function createHelixClient(opts: CreateHelixClientOptions): HelixClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl ?? HELIX_BASE_URL;
  const headers = () => ({
    "Client-Id": opts.clientId,
    Authorization: `Bearer ${opts.token}`,
    "Content-Type": "application/json",
  });

  const request = async <T>(method: string, path: string, init: RequestInit): Promise<T> => {
    const url = init.body ? path : path; // kept for symmetry
    const response = await fetchImpl(url, { ...init, method, headers: headers() });
    // 204 is typical for DELETEs; no body to parse.
    if (response.status === 204) return undefined as T;
    // Read body even on non-2xx so HelixError carries diagnostics.
    let body: unknown = null;
    const text = await response.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      throw new HelixError(response.status, url, body);
    }
    return body as T;
  };

  return {
    get<T>(path: string, query?: Record<string, string | number | boolean>) {
      const url = buildUrl(baseUrl, path, query);
      return request<T>("GET", url, {});
    },
    post<T>(path: string, body: unknown) {
      const url = buildUrl(baseUrl, path);
      return request<T>("POST", url, { body: JSON.stringify(body ?? {}) });
    },
    patch<T>(path: string, body: unknown) {
      const url = buildUrl(baseUrl, path);
      return request<T>("PATCH", url, { body: JSON.stringify(body ?? {}) });
    },
    async delete(path: string) {
      const url = buildUrl(baseUrl, path);
      await request<void>("DELETE", url, {});
    },
  };
}

/** Convenience wrapper around GET /helix/users?login=…. Returns the first user or null. */
export async function getUserByLogin(
  helix: HelixClient,
  login: string,
): Promise<{ id: string; login: string; display_name: string } | null> {
  const response = await helix.get<{
    data: Array<{ id: string; login: string; display_name: string }>;
  }>("users", { login });
  return response.data[0] ?? null;
}
