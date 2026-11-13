const BASE = "https://app.towbook.com";

const EXACT = new Set([
  "/api/calls/",
  "/api/calls/search",
  "/api/calls/Search",
  "/api/calls/completed",
  "/api/calls/cancelled",
  "/api/calls/Current",
  "/api/calls/ByInvoiceStatus",
  "/api/calls/ByAccounts",
  "/api/quotes",
  "/api/quotes/",
  "/api/callRequests/",
  "/api/drivers",
  "/api/drivers/full",
  "/api/trucks",
  "/api/masterAccounts/",
  "/api/accounts",
  "/api/accounts/",
  "/api/accounts/unpaidinvoices",
  "/api/groups",
  "/api/companydispatchstatuses",
  "/api/eventnotifications",
  "/api/config",
  "/api/config/dispatch",
  "/api/navigation",
  "/api/vehicleModels",
  "/api/paymentTypes",
  "/api/commissions",
  "/api/commissionDriverReportOptions",
  "/api/reports",
  "/Reports/Payroll",
]);

const PATTERNS = [
  /^\/api\/calls\/\d+$/,
  /^\/api\/calls\/\d+\/notes$/,
  /^\/api\/calls\/\d+\/notes\/\d+$/,
  /^\/api\/calls\/\d+\/payments$/,
  /^\/api\/calls\/\d+\/payments\/\d+$/,
  /^\/api\/calls\/\d+\/invoice$/,
  /^\/api\/callRequests\/\d+\/details$/,
  /^\/api\/config\/company\/\d+$/,
  /^\/api\/accounts\/\d+$/,
  /^\/api\/accounts\/\d+\/notes$/,
  /^\/api\/accounts\/\d+\/payments$/,
  /^\/api\/accounts\/\d+\/payments\/\d+$/,
  /^\/api\/accounts\/\d+\/statements$/,
  /^\/api\/accounts\/\d+\/statements\/\d+$/,
  /^\/api\/accounts\/\d+\/balance$/,
  /^\/api\/accounts\/\d+\/locations$/,
  /^\/api\/drivers\/\d+$/,
  /^\/api\/trucks\/\d+$/,
  /^\/api\/commissions\/\d+$/,
  /^\/ajax\/dispatch\/\d+\/internalNotes$/,
  /^\/ajax\/dispatch\/\d+\/payments$/,
];

const REPORT_TYPES = new Set([
  "CallWorkflow",
  "AccountPayments",
  "AccountPerformance",
  "AccountReceivable",
  "CallAnalysis",
  "CancelledCall",
  "DeletedCalls",
  "DriverActivity",
  "PaymentVerification",
  "CompanyIncome",
  "IncomeSummary",
  "RevenueIncome",
  "SalesTax",
  "TruckExpenses",
  "SubcontractorBasic",
]);

const REPORT_FIELDS = new Set([
  "reportType",
  "dateStart",
  "dateEnd",
  "dateRangeField",
  "companyId",
  "accountIds",
  "accountTypeIds",
  "driverIds",
  "truckId",
  "truckIds",
  "impounds",
  "paymentTypeIds",
  "dispatchReasonId",
]);

export function assertGetPath(path) {
  if (typeof path !== "string" || path.includes("..") || path.includes("\\") || path.includes("\0")) {
    throw new Error("Refused path");
  }
  const clean = path.split("?")[0];
  if (!(clean.startsWith("/api/") || clean.startsWith("/Reports/") || clean.startsWith("/ajax/dispatch/"))) {
    throw new Error("Refused path outside the read allowlist");
  }
  if (EXACT.has(clean) || PATTERNS.some((re) => re.test(clean))) return clean;
  throw new Error(`Refused path ${clean}. This server is read-only and allowlisted.`);
}

export function assertReportQuery(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Report query needs an object");
  }
  if (!REPORT_TYPES.has(body.reportType)) {
    throw new Error("Report type is not allowlisted");
  }
  for (const key of Object.keys(body)) {
    if (!REPORT_FIELDS.has(key)) throw new Error(`Refused report field ${key}`);
  }
  return { path: "/api/reports", body };
}

export function buildUrl(path, query) {
  const clean = assertGetPath(path);
  const url = new URL(clean, BASE);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) throw new Error("Refused query key");
      url.searchParams.set(key, String(value));
    }
  }
  if (url.origin !== BASE) throw new Error("Refused host");
  return url;
}

export { BASE, REPORT_TYPES };
