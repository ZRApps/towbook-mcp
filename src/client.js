import { assertReportQuery, buildUrl } from "./allowlist.js";
import { loadCookie } from "./cookie.js";

const DEFAULT_TIMEOUT_MS = 20000;

export function createClient({ cookie, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, companyId } = {}) {
  const session = cookie || loadCookie();

  async function send(method, url, headers, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === "AbortError") throw new Error(`TowBook timed out on ${method} ${url.pathname}`);
      throw new Error(`TowBook request failed for ${method} ${url.pathname}`);
    } finally {
      clearTimeout(timer);
    }
  }

  function headersFor(callCompany, accept) {
    const headers = {
      Accept: accept,
      "X-Requested-With": "XMLHttpRequest",
      Cookie: session,
    };
    const company = callCompany || companyId;
    if (company) headers["X-Company"] = String(company);
    return headers;
  }

  async function readResponse(response, method, pathname) {
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`TowBook redirected ${method} ${pathname} (${response.status}). Session may have expired.`);
    }
    const text = await response.text();
    if (response.status === 401 || response.status === 403 || looksLikeLogin(text)) {
      throw new Error(`TowBook rejected ${method} ${pathname} (${response.status}). Refresh the cookie.`);
    }
    if (!response.ok) throw new Error(`TowBook ${method} ${pathname} returned ${response.status}`);
    return text;
  }

  async function get(path, query, options = {}) {
    const url = buildUrl(path, query);
    const response = await send("GET", url, headersFor(options.companyId, "application/json, text/plain, */*"));
    const text = await readResponse(response, "GET", url.pathname);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`TowBook GET ${url.pathname} did not return JSON`);
    }
  }

  async function getText(path, query, options = {}) {
    const url = buildUrl(path, query);
    const response = await send("GET", url, headersFor(options.companyId, "text/html, */*"));
    return readResponse(response, "GET", url.pathname);
  }

  async function queryReport(body, options = {}) {
    const query = assertReportQuery(body);
    const url = buildUrl(query.path);
    const headers = headersFor(options.companyId, "application/json");
    headers["Content-Type"] = "application/json";
    const response = await send("POST", url, headers, JSON.stringify(query.body));
    const text = await readResponse(response, "POST", url.pathname);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("TowBook report did not return JSON");
    }
  }

  return { get, getText, queryReport };
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
