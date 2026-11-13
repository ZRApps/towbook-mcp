import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function defaultCookiePath() {
  return join(homedir(), ".config", "towbook-mcp", "cookie.txt");
}

export function loadCookie(env = process.env) {
  const fromEnv = (env.TOWBOOK_COOKIE || "").trim();
  if (fromEnv) return normalizeCookie(fromEnv);
  const file = env.TOWBOOK_COOKIE_FILE || defaultCookiePath();
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new Error(
      `No TowBook cookie. Set TOWBOOK_COOKIE or write the Cookie header to ${file} (mode 600). See README.`
    );
  }
  return normalizeCookie(raw);
}

export function normalizeCookie(raw) {
  let text = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("TowBook cookie is empty.");
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text);
    text = String(parsed.cookie || parsed.Cookie || "").trim();
  }
  const line = text.split(/\r?\n/).find((l) => l.trim()) || "";
  text = line.replace(/^cookie\s*:\s*/i, "").trim();
  if (!text || /[\r\n]/.test(text)) throw new Error("TowBook cookie is empty or malformed.");
  if (text.length < 8) throw new Error("TowBook cookie looks too short.");
  return text;
}
