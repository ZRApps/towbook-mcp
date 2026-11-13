import { test } from "node:test";
import assert from "node:assert/strict";
import { assertGetPath, assertReportQuery } from "../src/allowlist.js";
import { billingPacket, parseHtmlTable } from "../src/billing.js";
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

test("billing packet keeps note kinds separate and does not invent payroll", () => {
  const packet = billingPacket({
    call: {
      callNumber: 10,
      notes: "dispatch note",
      invoiceItems: [{ name: "discount", price: -10, quantity: 1, itemTotal: -10 }],
      invoiceTotal: 40,
      balanceDue: 0,
      attributes: [{ attributeId: 47, value: "bill this account" }],
      assets: [{ year: 2020, make: "Example", model: "Truck", vin: "VINTEST", drivers: [{ driver: { id: 1, name: "Pat Example" }, truck: { id: 2, name: "Unit 1" } }] }],
      commissions: { totalTicketValue: 100, drivers: [{ driverId: 1, value: 100 }] },
    },
    payments: [{ typeName: "Card", amount: 40 }],
    internalNoteList: [{ id: 9, content: "hours note", ownerName: "Clerk", ownerUserId: 3, createDate: "2026-11-12T00:00:00" }],
    account: { notes: "account standing note" },
    accountNoteList: [{ id: 4, note: "account history", authorName: "Clerk", createDate: "2026-11-01" }],
  });
  assert.equal(packet.callNotes, "dispatch note");
  assert.equal(packet.billingNotes, "bill this account");
  assert.equal(packet.internalNotes[0].text, "hours note");
  assert.equal(packet.internalNotes[0].author, "Clerk");
  assert.equal(packet.accountNotes, "account standing note");
  assert.equal(packet.drivers[0].truckName, "Unit 1");
  assert.equal(packet.invoiceItems[0].itemTotal, -10);
  assert.equal(packet.commissionAllocation.meaning.includes("Not calculated payroll"), true);
  assert.equal(JSON.stringify(packet).includes("internalBillingNotes"), false);
  assert.equal(packet.warnings.length, 1);
});

test("missing internal notes are a warning, not a copy of call notes", () => {
  const packet = billingPacket({
    call: { notes: "dispatch note", attributes: [] },
    internalNoteList: { error: "TowBook GET /api/calls/1/notes returned 404" },
  });
  assert.deepEqual(packet.internalNotes, []);
  assert.equal(packet.callNotes, "dispatch note");
  assert.match(packet.warnings.join(" "), /Internal note history was not loaded/);
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
