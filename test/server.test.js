import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/index.js";
import { createClient } from "../src/client.js";

test("server lists only read tools and returns a board summary", async () => {
  const client = createClient({
    cookie: "session=abc12345",
    fetchImpl: async () => new Response(JSON.stringify([{ id: 1, callNumber: 8, status: { name: "Active" } }]), {
      headers: { "content-type": "application/json" },
    }),
  });
  const server = buildServer(client);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
  const listed = await mcp.listTools();
  const names = listed.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "get_call",
    "get_call_request",
    "get_config",
    "list_accounts",
    "list_board_calls",
    "list_call_requests",
    "list_dispatch_statuses",
    "list_drivers",
    "list_groups",
    "list_notifications",
    "list_quotes",
    "search_calls",
  ]);
  assert.equal(listed.tools.every((t) => t.annotations?.readOnlyHint === true), true);
  const result = await mcp.callTool({ name: "list_board_calls", arguments: { limit: 5 } });
  assert.match(result.content[0].text, /"callNumber": 8/);
  await mcp.close();
});
