import { shapeResult } from "./client.js";
import { billingRow, parseHtmlTable } from "./billing.js";

function limitOf(value, fallback = 50) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 200);
}

function companyOf(args) {
  return args?.companyId ? { companyId: args.companyId } : {};
}

function digits(value, label) {
  if (!/^\d+$/.test(String(value || ""))) throw new Error(`${label} must be digits.`);
  return String(value);
}

async function optionalGet(client, path, options) {
  try {
    return await client.get(path, undefined, options);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "request failed" };
  }
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
  {
    name: "get_account",
    description: "Get one account, including account notes, address, balance, and credit hold. Read-only.",
    schema: { id: { type: "string" }, companyId: { type: "string" } },
    async run(client, args) {
      return client.get(`/api/accounts/${digits(args.id, "id")}`, undefined, companyOf(args));
    },
  },
  {
    name: "get_job",
    description: "Get one job/call with invoice, vehicle, PO, and billing fields when TowBook includes them. Read-only. Not the short board summary.",
    schema: { id: { type: "string" }, companyId: { type: "string" } },
    async run(client, args) {
      return client.get(`/api/calls/${digits(args.id, "id")}`, undefined, companyOf(args));
    },
  },
  {
    name: "get_job_payments",
    description: "Payments on one job. Includes payment type so cash, check, and card can be told apart. Read-only.",
    schema: { id: { type: "string" }, companyId: { type: "string" } },
    async run(client, args) {
      return client.get(`/api/calls/${digits(args.id, "id")}/payments`, undefined, companyOf(args));
    },
  },
  {
    name: "get_invoice",
    description: "Invoice for one job. Read-only.",
    schema: { id: { type: "string" }, companyId: { type: "string" } },
    async run(client, args) {
      return client.get(`/api/calls/${digits(args.id, "id")}/invoice`, undefined, companyOf(args));
    },
  },
  {
    name: "get_billing_packet",
    description: "One job as a billing row: driver, truck, vehicle, VIN, invoice, PO, weight class, totals, payments, balance, commission, internal billing notes, and account notes. Read-only.",
    schema: { id: { type: "string" }, companyId: { type: "string" } },
    async run(client, args) {
      const id = digits(args.id, "id");
      const options = companyOf(args);
      const call = await client.get(`/api/calls/${id}`, undefined, options);
      const accountId = call?.accountId || call?.billToAccountId || call?.account?.id;
      const [payments, notes, account, internalNotes] = await Promise.all([
        optionalGet(client, `/api/calls/${id}/payments`, options),
        optionalGet(client, `/api/calls/${id}/notes`, options),
        accountId ? optionalGet(client, `/api/accounts/${accountId}`, options) : null,
        client.getText ? client.getText(`/ajax/dispatch/${id}/internalNotes`, undefined, options).catch((err) => ({ error: err instanceof Error ? err.message : "request failed" })) : null,
      ]);
      const row = billingRow({
        call,
        payments: payments?.error ? [] : payments,
        notes: notes?.error ? [] : notes,
        account: account?.error ? {} : account,
      });
      if (typeof internalNotes === "string" && internalNotes && !row.internalBillingNotes) {
        row.internalBillingNotes = internalNotes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
      }
      return {
        row,
        missing: [payments, notes, account, internalNotes].filter((item) => item && item.error).map((item) => item.error),
      };
    },
  },
  {
    name: "list_payment_types",
    description: "Payment type names, including cash, check, and card. Read-only.",
    schema: { companyId: { type: "string" } },
    async run(client, args) {
      return client.get("/api/paymentTypes", undefined, companyOf(args));
    },
  },
  {
    name: "list_customer_accounts",
    description: "Account records, including account notes when TowBook returns them on the list. Read-only.",
    schema: { limit: { type: "number" }, companyId: { type: "string" } },
    async run(client, args) {
      return shapeResult(await client.get("/api/accounts", undefined, companyOf(args)), { limit: limitOf(args.limit, 100) });
    },
  },
  {
    name: "commission_report",
    description: "Driver commission report (the payroll table: driver, license, truck, invoice, PO, weight class, totals, payments, balance, driver base, commission). Read-only HTML. Note columns are usually blank in this report; use get_billing_packet for notes.",
    schema: {
      dateStart: { type: "string" },
      dateEnd: { type: "string" },
      driverId: { type: "string" },
      companyId: { type: "string" },
    },
    async run(client, args) {
      const html = await client.getText("/Reports/Payroll", {
        dateStart: args.dateStart,
        dateEnd: args.dateEnd,
        driverId: args.driverId,
      }, companyOf(args));
      const parsed = parseHtmlTable(html);
      return { count: parsed.rows.length, headers: parsed.headers, rows: parsed.rows.slice(0, 200) };
    },
  },
  {
    name: "run_report",
    description: "Run a TowBook read report such as CallWorkflow. This is a query, not a save. CallWorkflow rows include billingNotes. Account notes are not on the row; use get_account for those. Read-only.",
    schema: {
      reportType: { type: "string" },
      dateStart: { type: "string" },
      dateEnd: { type: "string" },
      dateRangeField: { type: "string" },
      companyId: { type: "string" },
    },
    async run(client, args) {
      const data = await client.queryReport({
        reportType: args.reportType,
        dateStart: args.dateStart,
        dateEnd: args.dateEnd,
        dateRangeField: args.dateRangeField,
        companyId: args.companyId,
      }, companyOf(args));
      const rows = data?.reportData || data?.items || [];
      return {
        count: Array.isArray(rows) ? rows.length : 0,
        rows: Array.isArray(rows) ? rows.slice(0, 200) : data,
        truncated: Array.isArray(rows) && rows.length > 200,
      };
    },
  },
];
