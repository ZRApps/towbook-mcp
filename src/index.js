import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from "./client.js";
import { toolDefs } from "./tools.js";

const number = z.number().optional();
const text = z.string().optional();

const schemas = {
  list_board_calls: { limit: number, companyId: text },
  search_calls: {
    customer: text, vin: text, year: text, make: text, model: text,
    startDate: text, endDate: text, driverId: text, dispatcherId: text,
    limit: number, companyId: text,
  },
  get_call: { id: z.string(), companyId: text },
  list_quotes: { limit: number, companyId: text },
  list_call_requests: { limit: number, companyId: text },
  get_call_request: { id: z.string(), companyId: text },
  list_drivers: { companyId: text },
  list_accounts: { typeId: text, companyId: text },
  list_groups: { companyId: text },
  list_dispatch_statuses: { companyId: text },
  get_config: { scope: text, companyId: text },
  list_notifications: { companyId: text },
};

function textResult(value) {
  const text = JSON.stringify(value, null, 2);
  const cap = 120000;
  const body = text.length > cap ? `${text.slice(0, cap)}\n…truncated` : text;
  return { content: [{ type: "text", text: body }] };
}

export function buildServer(client) {
  const server = new McpServer({ name: "towbook", version: "0.1.0" });
  for (const tool of toolDefs) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: schemas[tool.name],
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (args) => {
      try {
        return textResult(await tool.run(client, args || {}));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tool failed";
        return { content: [{ type: "text", text: message }], isError: true };
      }
    });
  }
  return server;
}

async function main() {
  const client = createClient();
  const server = buildServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : "towbook-mcp failed to start");
    process.exit(1);
  });
}
