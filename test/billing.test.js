import { test } from "node:test";
import assert from "node:assert/strict";
import { assertGetPath, assertReportQuery } from "../src/allowlist.js";
import { billingRow, parseHtmlTable } from "../src/billing.js";
import { createClient } from "../src/client.js";
import { toolDefs } from "../src/tools.js";

test("billing paths are readable and writes stay refused", () => {
  assert.equal(assertGetPath("/api/calls/9/payments"), "/api/calls/9/payments");
  assert.equal(assertGetPath("/api/accounts/3/notes"), "/api/accounts/3/notes");
  assert.equal(assertGetPath("/Reports/Payroll"), "/Reports/Payroll");
  assert.throws(() => assertGetPath("/api/accounts/3/digitaldelete"), /Refused path/);
  assert.throws(() => assertReportQuery({ reportType: "CallWorkflow", export: "1" }), /Refused report field/);
  assert.equal(assertReportQuery({ reportType: "CallWorkflow", dateStart: "2026-11-12" }).path, "/api/reports");
});

test("billing row keeps notes and payment type", () => {
  const row = billingRow({
    call: { callNumber: 10, invoiceNumber: "A-1", invoiceTotal: 50, balanceDue: 0, driver: "Pat Example" },
    payments: [{ paymentType: "Cash", amount: 50, paymentDate: "2026-11-12" }],
    notes: [{ text: "internal yard note" }],
    account: { name: "Example Account", accountNotes: "do not bill fuel" },
  });
  assert.equal(row.internalBillingNotes, "internal yard note");
  assert.equal(row.accountNotes, "do not bill fuel");
  assert.equal(row.payments[0].type, "Cash");
  assert.equal(JSON.stringify(row).includes("super-secret"), false);
});

test("commission report parses an HTML table and does not post", async () => {
  const html = `<table><tr><th>Driver</th><th>Invoice #</th><th>Account notes</th></tr><tr><td>Pat Example</td><td>A-1</td><td></td></tr></table>`;
  let method = "";
  const client = createClient({
    cookie: "session=abc12345",
    fetchImpl: async (url, init) => {
      method = init.method;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  const tool = toolDefs.find((item) => item.name === "commission_report");
  const result = await tool.run(client, { dateStart: "2026-11-12", dateEnd: "2026-11-12" });
  assert.equal(method, "GET");
  assert.equal(result.rows[0].Driver, "Pat Example");
  assert.equal(result.rows[0]["Account notes"], "");
  assert.equal(parseHtmlTable(html).headers.length, 3);
});

test("report query refuses a non-report post", async () => {
  let called = false;
  const client = createClient({
    cookie: "session=abc12345",
    fetchImpl: async () => {
      called = true;
      return new Response("{}");
    },
  });
  await assert.rejects(() => client.queryReport({ reportType: "DeleteEverything" }), /not allowlisted/);
  assert.equal(called, false);
});
