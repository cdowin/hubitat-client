// Transport layer for the hub: GET (JSON) and form POST, with timeouts and
// uniform error shaping. The only place that talks to `fetch` — add retries,
// auth, or logging here and every call inherits it.

import { TIMEOUT_MS, HTTP_METHOD, HEADER, CONTENT_TYPE_FORM, XHR } from "./constants.mjs";

// Endpoints return JSON, except /device/runmethod which returns an HTML page on
// success. Parse JSON when possible; hand back raw text otherwise.
function parseBody(text) {
  try { return JSON.parse(text); } catch { return text; }
}

export class HttpClient {
  // `fetchImpl` is injectable so the transport can be tested without a network.
  constructor(baseUrl, { fetchImpl = fetch } = {}) {
    this.base = baseUrl.replace(/\/$/, "");
    this.fetch = fetchImpl;
  }

  async getJson(path) {
    const res = await this.fetch(this.base + path, { signal: AbortSignal.timeout(TIMEOUT_MS.GET) });
    if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
    return parseBody(await res.text());
  }

  async postForm(path, params) {
    const res = await this.fetch(this.base + path, {
      method: HTTP_METHOD.POST,
      headers: { [HEADER.CONTENT_TYPE]: CONTENT_TYPE_FORM, [HEADER.REQUESTED_WITH]: XHR },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(TIMEOUT_MS.POST),
    });
    if (!res.ok) throw new Error(`POST ${path} -> HTTP ${res.status}`);
    return parseBody(await res.text());
  }
}
