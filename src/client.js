import { buildUrl } from "./allowlist.js";
import { loadCookie } from "./cookie.js";

const DEFAULT_TIMEOUT_MS = 20000;

export function createClient({ cookie, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, companyId } = {}) {
  const session = cookie || loadCookie();

  async function get(path, query, { companyId: callCompany } = {}) {
    const url = buildUrl(path, query);
    const headers = {
      Accept: "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      Cookie: session,
    };
    const company = callCompany || companyId;
    if (company) headers["X-Company"] = String(company);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, { method: "GET", headers, redirect: "manual", signal: controller.signal });
    } catch (err) {
      if (err && err.name === "AbortError") throw new Error(`TowBook timed out on GET ${url.pathname}`);
      throw new Error(`TowBook request failed for GET ${url.pathname}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      throw new Error(`TowBook redirected GET ${url.pathname} (${response.status}). Session may have expired.`);
    }
    const text = await response.text();
    if (response.status === 401 || response.status === 403 || looksLikeLogin(text)) {
      throw new Error(`TowBook rejected GET ${url.pathname} (${response.status}). Refresh the cookie.`);
    }
    if (!response.ok) {
      throw new Error(`TowBook GET ${url.pathname} returned ${response.status}`);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`TowBook GET ${url.pathname} did not return JSON`);
    }
  }

  return { get };
}

function looksLikeLogin(text) {
  if (!text || text.length > 4000) return false;
  return /<form[^>]+login/i.test(text) || /name=["']password["']/i.test(text);
}

export function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.calls)) return data.calls;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.results)) return data.results;
  return null;
}

export function summarizeCall(call) {
  if (!call || typeof call !== "object") return call;
  const status = call.status;
  return {
    id: call.id ?? null,
    callNumber: call.callNumber ?? null,
    status: typeof status === "object" && status ? status.name || status.id || null : status ?? null,
    priority: call.priority ?? null,
    towSource: call.towSource ?? null,
    towDestination: call.towDestination ?? null,
    account: call.account?.name || call.billToAccountName || null,
    owner: call.owner?.name || null,
    createDate: call.createDate ?? null,
    impound: call.impound ?? null,
  };
}

export function shapeResult(data, { limit = 50, summarize = false } = {}) {
  const list = asList(data);
  if (!list) {
    const keys = data && typeof data === "object" ? Object.keys(data).slice(0, 40) : [];
    return { kind: "object", keys, data };
  }
  const capped = list.slice(0, limit);
  return {
    kind: "list",
    count: list.length,
    returned: capped.length,
    truncated: list.length > capped.length,
    items: summarize ? capped.map(summarizeCall) : capped,
  };
}
