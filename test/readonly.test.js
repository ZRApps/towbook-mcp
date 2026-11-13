import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { assertGetPath, buildUrl } from "../src/allowlist.js";
import { normalizeCookie } from "../src/cookie.js";
import { createClient, summarizeCall } from "../src/client.js";
import { toolDefs } from "../src/tools.js";

test("allowlist accepts known reads and rejects writes", () => {
  assert.equal(assertGetPath("/api/calls/"), "/api/calls/");
  assert.equal(assertGetPath("/api/calls/42"), "/api/calls/42");
  assert.throws(() => assertGetPath("/api/calls/42/uncancel"), /Refused path/);
  assert.throws(() => assertGetPath("/api/callRequests/9/accept"), /Refused path/);
  assert.throws(() => assertGetPath("/api/pusher"), /Refused path/);
  assert.throws(() => assertGetPath("https://evil.example/api/calls/"), /Refused path/);
});

test("buildUrl stays on app.towbook.com and drops empty query keys", () => {
  const url = buildUrl("/api/calls/search", { customer: "acme", vin: "", driverId: undefined });
  assert.equal(url.origin, "https://app.towbook.com");
  assert.equal(url.pathname, "/api/calls/search");
  assert.equal(url.searchParams.get("customer"), "acme");
  assert.equal(url.searchParams.has("vin"), false);
});

test("cookie parser accepts a header line and rejects empty", () => {
  assert.equal(normalizeCookie("Cookie: session=abc12345"), "session=abc12345");
  assert.throws(() => normalizeCookie("   "), /empty/);
});

test("client sends only GET and never echoes the cookie", async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, cookie: req.headers.cookie });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify([{ id: 7, callNumber: 100, status: { name: "Waiting" }, towSource: "A", towDestination: "B" }]));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const secret = "session=super-secret-value";
  const client = createClient({
    cookie: secret,
    fetchImpl: (url, init) => fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, init),
  });
  const tool = toolDefs.find((t) => t.name === "list_board_calls");
  const result = await tool.run(client, { limit: 5 });
  server.close();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].method, "GET");
  assert.match(seen[0].url, /view=board/);
  assert.equal(seen[0].cookie, secret);
  assert.equal(result.items[0].callNumber, 100);
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
});

test("client refuses a non-GET before the network", async () => {
  let called = false;
  const client = createClient({
    cookie: "session=abc12345",
    fetchImpl: async (_url, init) => {
      called = true;
      if (init.method !== "GET") throw new Error("method leaked");
      return new Response("{}", { status: 200 });
    },
  });
  await assert.rejects(() => client.get("/api/calls/1/uncancel"), /Refused path/);
  assert.equal(called, false);
});

test("search_calls requires a filter", async () => {
  const tool = toolDefs.find((t) => t.name === "search_calls");
  const client = createClient({ cookie: "session=abc12345", fetchImpl: async () => new Response("[]") });
  await assert.rejects(() => tool.run(client, {}), /at least one filter/);
});

test("summarizeCall does not keep notes", () => {
  const summary = summarizeCall({ id: 1, notes: "private note", owner: { name: "Pat" } });
  assert.equal(summary.owner, "Pat");
  assert.equal("notes" in summary, false);
});
