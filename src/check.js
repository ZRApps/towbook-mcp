import { createClient } from "./client.js";
import { toolDefs } from "./tools.js";

const tool = toolDefs.find((t) => t.name === "list_dispatch_statuses");
const client = createClient();
try {
  const result = await tool.run(client, {});
  const count = result && typeof result === "object" && "count" in result ? result.count : "object";
  console.log(`ok GET /api/companydispatchstatuses shape=${result.kind || "raw"} count=${count}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : "check failed");
  process.exit(1);
}
