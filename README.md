# TowBook MCP

Read-only local MCP server for a TowBook account you are already logged into. It does not create, update, cancel, or delete anything.

TowBook does not publish an API for this. The server calls the same JSON endpoints the dispatch site uses, with your browser session cookie. Those endpoints can change when TowBook ships a new frontend.

## How it works

```
Claude Desktop / Claude Code / ChatGPT desktop (Codex or Work)
        |  stdio
        v
towbook-mcp  (this process, on your machine)
        |  GET only, allowlisted paths, Cookie header
        v
https://app.towbook.com
```

The process refuses every method except GET, and refuses any path that is not on the allowlist. Accept, cancel, complete, and notification-read calls exist in the TowBook app. They are not tools.

The cookie never goes in git, Slack, or this README. It lives in a file only your user can read, or in the `TOWBOOK_COOKIE` environment variable.

## Tools

| Tool | Endpoint | Notes |
| --- | --- | --- |
| `list_board_calls` | `GET /api/calls/?view=board` | Dispatch board. Summaries only. |
| `search_calls` | `GET /api/calls/search` | Needs at least one filter. |
| `get_call` | `GET /api/calls/{id}` | Best-effort. Seen as a numeric XHR, not confirmed against a body. |
| `list_quotes` | `GET /api/quotes` | Summaries. |
| `list_call_requests` | `GET /api/callRequests/` | |
| `get_call_request` | `GET /api/callRequests/{id}/details` | |
| `list_drivers` | `GET /api/drivers` | |
| `list_accounts` | `GET /api/masterAccounts/` | Optional `typeId`. The call-request screen sends `5`. |
| `list_groups` | `GET /api/groups` | |
| `list_dispatch_statuses` | `GET /api/companydispatchstatuses` | |
| `get_config` | `/api/config/dispatch`, `/api/config/company/{id}`, or `/api/config` | |
| `list_notifications` | `GET /api/eventnotifications` | Does not mark them read. |

Pass `companyId` when you have more than one company. It is sent as `X-Company`.

The board list is a short summary. It does not include invoices, payments, commissions, or notes. Use these when you need the billing row:

- `commission_report` reads the payroll table: driver, license, truck, vehicle, VIN, call, invoice, account, PO, weight class, totals, payments, balance, payment status, driver base, commission. TowBook leaves the note columns blank on that report.
- `get_billing_packet` fills the gap: internal billing notes and account notes, plus cash, check, or card on each payment.
- `get_account`, `get_job`, `get_job_payments`, `get_invoice`, and `list_payment_types` are the underlying records.
- `run_report` with `reportType` `CallWorkflow` is a query, not a save. Those rows include `billingNotes`. It cannot create or change a call.

Photos, file uploads, and every write stay off.

## 1. Get the cookie

You need a TowBook login. The cookie is the session. Treat it like a password.

1. In Brave or Chrome, open [https://app.towbook.com](https://app.towbook.com) and log in. Land on Dispatching.
2. Open DevTools. On a Mac: View → Developer → Developer Tools, or press Command-Option-I.
3. Open the Network tab. If it is empty, reload the dispatch page. Reloading only reads the page.
4. In the filter box, type `app.towbook.com` or click Fetch/XHR.
5. Click a request whose name is `quotes`, `callRequests/`, or `companydispatchstatuses`. Do not use a request to Google, Sentry, or Pusher.
6. Open the Headers tab. Under Request Headers, find `Cookie`.
7. Copy the value only. That is the text after `Cookie: `, the whole string, including every `name=value` pair separated by semicolons.
8. Do not copy the response body. Do not paste the cookie into chat, Slack, or a git repo.

Save it:

```bash
mkdir -p ~/.config/towbook-mcp
chmod 700 ~/.config/towbook-mcp
# Paste the cookie into this file. One line. No "Cookie:" prefix required.
# Then:
chmod 600 ~/.config/towbook-mcp/cookie.txt
```

A header line `Cookie: session=...` is also accepted. The file must not be world-readable.

The cookie dies when you log out, or when TowBook expires the session. If tools start returning "Refresh the cookie", repeat these steps. Do not store the cookie in the shell history. Prefer the file over `export TOWBOOK_COOKIE=...`.

## 2. Install locally

Node 20 or newer.

```bash
git clone https://github.com/ZRApps/towbook-mcp.git
cd towbook-mcp
npm install
node src/check.js
```

A line starting with `ok` means the session works. The check does not print the cookie or the response body.

## 3. Connect Claude Desktop

Quit Claude Desktop first.

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`. Create it if it is missing. Merge this into `mcpServers` rather than deleting other servers. Replace both paths.

```json
{
  "mcpServers": {
    "towbook": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/towbook-mcp/src/index.js"],
      "env": {
        "TOWBOOK_COOKIE_FILE": "/Users/YOU/.config/towbook-mcp/cookie.txt"
      }
    }
  }
}
```

A starter file is in `examples/claude_desktop_config.json`. Restart Claude Desktop. The server should appear in the tool list. Ask it to list dispatch statuses, not to change a call.

## 4. Connect Claude Code

From any directory:

```bash
claude mcp add --transport stdio --env TOWBOOK_COOKIE_FILE=$HOME/.config/towbook-mcp/cookie.txt towbook -- node /ABSOLUTE/PATH/TO/towbook-mcp/src/index.js
```

If that flag set differs in your Claude Code version, put the same JSON block in the project's `.mcp.json` or in `~/.claude.json` under `mcpServers`. Restart the session. `claude mcp list` should show `towbook`.

## 5. Connect ChatGPT

Standard Chat, and the older ChatGPT Classic app, cannot launch a local stdio server. They only attach to remote HTTP connectors. This server is not exposed on the internet, and it should not be. A public tunnel would send the session cookie's data off the machine.

Use the current ChatGPT desktop app, in Codex or ChatGPT Work:

1. Open Settings and find Add MCP Server (Codex and ChatGPT Work run locally and accept stdio).
2. Name: `towbook`
3. Type: STDIO
4. Command: `node /ABSOLUTE/PATH/TO/towbook-mcp/src/index.js`
5. Environment: `TOWBOOK_COOKIE_FILE` = `/Users/YOU/.config/towbook-mcp/cookie.txt`
6. Save, then start a Codex or Work thread and ask for a read, such as dispatch statuses.

If the dialog has no STDIO type, you are in standard Chat. Switch to Codex or Work. Do not paste a public URL.

## Security

- Read-only. A bug cannot POST, PUT, PATCH, or DELETE, because the client throws before the network call.
- Allowlisted paths only. `/api/calls/1/uncancel` and `/api/pusher` are refused.
- Redirects are not followed. A login redirect is reported as an expired session.
- Errors do not include the cookie.
- Do not commit `cookie.txt`, `.env`, or HAR files. `.gitignore` already excludes them.
- This is your TowBook data. The model will see whatever a tool returns. Prefer the summary tools over asking it to dump every field.

## Repository

Source: https://github.com/ZRApps/towbook-mcp

The cookie file, session values, and account records are not in this repository. Keep `~/.config/towbook-mcp/cookie.txt` on your machine only.

## Development

```bash
npm test
```

Tests use a local mock. They do not call TowBook.
