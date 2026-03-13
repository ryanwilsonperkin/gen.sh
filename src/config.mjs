import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { basename } from "node:path";
import { debug } from "./debug.mjs";

export function resolveConfigPath() {
  if (process.env.GEN_CONFIG && existsSync(process.env.GEN_CONFIG)) {
    debug(`config: using GEN_CONFIG=${process.env.GEN_CONFIG}`);
    return process.env.GEN_CONFIG;
  }

  const home = process.env.HOME || process.env.USERPROFILE || "";
  const xdg = process.env.XDG_CONFIG_HOME || `${home}/.config`;
  const candidates = [
    `${xdg}/gen/genrc.json`,
    `${xdg}/.genrc.json`,
    `${home}/.genrc.json`,
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      debug(`config: found ${p}`);
      return p;
    }
  }

  debug("config: no config file found");
  return null;
}

export function loadConfig() {
  const configPath = resolveConfigPath();
  if (!configPath) {
    process.stderr.write(
      "gen: no config file found. Create ~/.config/gen/genrc.json\nSee: gen --help\n",
    );
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(configPath, "utf-8"));

  // API key: env > config > apiKeyHelper
  let apiKey = process.env.GEN_API_KEY || raw.api_key || "";
  if (!apiKey && raw.apiKeyHelper) {
    debug(`config: running apiKeyHelper: ${raw.apiKeyHelper}`);
    try {
      apiKey = execSync(raw.apiKeyHelper, { encoding: "utf-8" }).trim();
    } catch {
      process.stderr.write("gen: apiKeyHelper command failed\n");
      process.exit(1);
    }
    if (!apiKey) {
      process.stderr.write("gen: apiKeyHelper command returned empty output\n");
      process.exit(1);
    }
  }

  const provider = process.env.GEN_PROVIDER || raw.provider || "openai";
  const model = process.env.GEN_MODEL || raw.model || "gpt-4o-mini";
  let apiUrl = process.env.GEN_API_URL || raw.api_url || "";

  // Auto-append paths for common base URLs
  if (apiUrl.endsWith("/v1")) {
    if (provider === "openai") apiUrl += "/chat/completions";
    if (provider === "anthropic") apiUrl += "/messages";
  }

  // Auto-detect shell from parent process
  let shell = process.env.GEN_SHELL || "";
  if (!shell) {
    try {
      const ppid = process.ppid;
      shell = execSync(`ps -p ${ppid} -o comm=`, { encoding: "utf-8" })
        .trim()
        .replace(/.*\//, "")
        .replace(/^-/, "");
    } catch {
      /* ignore */
    }
    shell = shell || basename(process.env.SHELL || "/bin/sh");
    debug(`shell: auto-detected '${shell}' from parent pid ${process.ppid}`);
  }

  if (!apiKey && provider !== "ollama") {
    process.stderr.write(
      "gen: api_key not set in config or GEN_API_KEY env var\n",
    );
    process.exit(1);
  }

  const config = { provider, model, apiKey, apiUrl, shell };
  debug(
    `config: provider=${provider} model=${model} api_url=${apiUrl} shell=${shell}`,
  );
  if (apiKey) {
    debug(
      `config: api_key=set (${apiKey.length} chars, ends ...${apiKey.slice(-8)})`,
    );
  }
  return config;
}
