import { shapeResult } from "./client.js";

function limitOf(value, fallback = 50) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 200);
}

function companyOf(args) {
  return args?.companyId ? { companyId: args.companyId } : {};
}

export const toolDefs = [
  {
    name: "list_board_calls",
    description: "List active dispatch-board calls. Read-only. Returns a short summary per call, not invoices or payments.",
    schema: {
      limit: { type: "number", description: "Max calls to return (1-200, default 50)." },
      companyId: { type: "string", description: "Optional TowBook company id, sent as X-Company." },
    },
    async run(client, args) {
      const data = await client.get("/api/calls/", { view: "board" }, companyOf(args));
      return shapeResult(data, { limit: limitOf(args.limit), summarize: true });
    },
  },
  {
    name: "search_calls",
    description: "Search calls by customer, VIN, vehicle, date, or driver. Read-only. At least one filter is required.",
    schema: {
      customer: { type: "string" },
      vin: { type: "string" },
      year: { type: "string" },
      make: { type: "string" },
      model: { type: "string" },
      startDate: { type: "string", description: "Date string as shown in TowBook search." },
      endDate: { type: "string" },
      driverId: { type: "string" },
      dispatcherId: { type: "string" },
      limit: { type: "number" },
      companyId: { type: "string" },
    },
    async run(client, args) {
      const query = {
        customer: args.customer,
        vin: args.vin,
        year: args.year,
        make: args.make,
        model: args.model,
        startDate: args.startDate,
        endDate: args.endDate,
        driverId: args.driverId,
        dispatcherId: args.dispatcherId,
      };
      if (!Object.values(query).some((v) => v !== undefined && v !== null && String(v).trim() !== "")) {
        throw new Error("search_calls needs at least one filter.");
      }
      const data = await client.get("/api/calls/search", query, companyOf(args));
      return shapeResult(data, { limit: limitOf(args.limit), summarize: true });
    },
  },
  {
    name: "get_call",
    description: "Fetch one call by numeric id. Read-only. This path was seen as an XHR name, not confirmed against a response body.",
    schema: {
      id: { type: "string", description: "Numeric call id." },
      companyId: { type: "string" },
    },
    async run(client, args) {
      if (!/^\d+$/.test(String(args.id || ""))) throw new Error("get_call id must be digits.");
      return client.get(`/api/calls/${args.id}`, undefined, companyOf(args));
    },
  },
  {
    name: "list_quotes",
    description: "List quotes. Read-only. Returns summaries.",
    schema: { limit: { type: "number" }, companyId: { type: "string" } },
    async run(client, args) {
      const data = await client.get("/api/quotes", undefined, companyOf(args));
      return shapeResult(data, { limit: limitOf(args.limit), summarize: true });
    },
  },
  {
    name: "list_call_requests",
    description: "List inbound call requests. Read-only.",
    schema: { limit: { type: "number" }, companyId: { type: "string" } },
    async run(client, args) {
      const data = await client.get("/api/callRequests/", undefined, companyOf(args));
      return shapeResult(data, { limit: limitOf(args.limit) });
    },
  },
  {
    name: "get_call_request",
    description: "Fetch one call request's details. Read-only.",
    schema: { id: { type: "string" }, companyId: { type: "string" } },
    async run(client, args) {
      if (!/^\d+$/.test(String(args.id || ""))) throw new Error("get_call_request id must be digits.");
      return client.get(`/api/callRequests/${args.id}/details`, undefined, companyOf(args));
    },
  },
  {
    name: "list_drivers",
    description: "List drivers. Read-only. jQuery loads this with a default GET.",
    schema: { companyId: { type: "string" } },
    async run(client, args) {
      const data = await client.get("/api/drivers", undefined, companyOf(args));
      return shapeResult(data, { limit: 200 });
    },
  },
  {
    name: "list_accounts",
    description: "List master accounts. Read-only. The call-request screen uses typeId=5; omit it to use the server default.",
    schema: {
      typeId: { type: "string", description: "Optional. The UI sends 5 for one account list." },
      companyId: { type: "string" },
    },
    async run(client, args) {
      const data = await client.get("/api/masterAccounts/", { typeId: args.typeId }, companyOf(args));
      return shapeResult(data, { limit: 200 });
    },
  },
  {
    name: "list_groups",
    description: "List dispatch groups. Read-only.",
    schema: { companyId: { type: "string" } },
    async run(client, args) {
      return shapeResult(await client.get("/api/groups", undefined, companyOf(args)), { limit: 200 });
    },
  },
  {
    name: "list_dispatch_statuses",
    description: "List company dispatch statuses. Read-only.",
    schema: { companyId: { type: "string" } },
    async run(client, args) {
      return shapeResult(await client.get("/api/companydispatchstatuses", undefined, companyOf(args)), { limit: 200 });
    },
  },
  {
    name: "get_config",
    description: "Read TowBook config. scope=dispatch is the board blob. scope=company needs companyId. scope=all sends X-Company: all. Read-only.",
    schema: {
      scope: { type: "string", description: "dispatch, company, or all. Default dispatch." },
      companyId: { type: "string" },
    },
    async run(client, args) {
      const scope = args.scope || "dispatch";
      if (scope === "dispatch") return client.get("/api/config/dispatch", undefined, companyOf(args));
      if (scope === "company") {
        if (!/^\d+$/.test(String(args.companyId || ""))) throw new Error("company scope needs a numeric companyId.");
        return client.get(`/api/config/company/${args.companyId}`);
      }
      if (scope === "all") return client.get("/api/config", undefined, { companyId: "all" });
      throw new Error("scope must be dispatch, company, or all.");
    },
  },
  {
    name: "list_notifications",
    description: "List event notifications. Read-only. Does not mark them read.",
    schema: { companyId: { type: "string" } },
    async run(client, args) {
      return shapeResult(await client.get("/api/eventnotifications", undefined, companyOf(args)), { limit: 100 });
    },
  },
];
