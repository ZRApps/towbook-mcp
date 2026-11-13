const BASE = "https://app.towbook.com";

const EXACT = new Set([
  "/api/calls/",
  "/api/calls/search",
  "/api/quotes",
  "/api/quotes/",
  "/api/callRequests/",
  "/api/drivers",
  "/api/masterAccounts/",
  "/api/groups",
  "/api/companydispatchstatuses",
  "/api/eventnotifications",
  "/api/config",
  "/api/config/dispatch",
  "/api/navigation",
  "/api/vehicleModels",
]);

const PATTERNS = [
  /^\/api\/calls\/\d+$/,
  /^\/api\/callRequests\/\d+\/details$/,
  /^\/api\/config\/company\/\d+$/,
];

export function assertGetPath(path) {
  if (typeof path !== "string" || !path.startsWith("/api/")) {
    throw new Error("Refused path outside /api/");
  }
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) {
    throw new Error("Refused path");
  }
  const clean = path.split("?")[0];
  if (EXACT.has(clean) || PATTERNS.some((re) => re.test(clean))) return clean;
  throw new Error(`Refused path ${clean}. This server is read-only and allowlisted.`);
}

export function buildUrl(path, query) {
  const clean = assertGetPath(path);
  const url = new URL(clean, BASE);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  if (url.origin !== BASE) throw new Error("Refused host");
  return url;
}

export { BASE };
