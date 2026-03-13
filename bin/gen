#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { basename } from "node:path";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

const VERSION = "0.2.0";

// ---------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------

const DEBUG = process.env.DEBUG === "1";

function debug(msg) {
  if (DEBUG) process.stderr.write(`[gen:debug] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function resolveConfigPath() {
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

function loadConfig() {
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

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a command-line generator. The user will describe a task and you must respond with EXACTLY one shell command (or pipeline) that accomplishes it. Rules:
- Output ONLY the command. No explanation, no markdown, no code fences, no commentary.
- Do not wrap the command in quotes unless the command itself requires them.
- The command must be valid for the user's shell.
- If the task is ambiguous, pick the most common interpretation.
- Never refuse. Always output a command.`;

function createProvider(config) {
  switch (config.provider) {
    case "openai": {
      const opts = { apiKey: config.apiKey };
      if (config.apiUrl) {
        // Strip /chat/completions for the base URL that @ai-sdk/openai expects
        opts.baseURL = config.apiUrl
          .replace(/\/chat\/completions$/, "")
          .replace(/\/$/, "");
      }
      return createOpenAI(opts);
    }
    case "anthropic": {
      const opts = { apiKey: config.apiKey };
      if (config.apiUrl) {
        opts.baseURL = config.apiUrl
          .replace(/\/messages$/, "")
          .replace(/\/$/, "");
      }
      return createAnthropic(opts);
    }
    case "ollama": {
      // Ollama exposes an OpenAI-compatible API
      const baseURL =
        config.apiUrl?.replace(/\/api\/chat$/, "") ||
        "http://localhost:11434";
      return createOpenAI({
        baseURL: `${baseURL}/v1`,
        apiKey: "ollama", // ollama doesn't need a real key
      });
    }
    default:
      process.stderr.write(`gen: unsupported provider '${config.provider}'\n`);
      process.exit(1);
  }
}

async function callLLM(config, prompt, alt) {
  const provider = createProvider(config);
  const shellHint = `Target shell: ${config.shell}`;

  let userContent;
  if (alt) {
    userContent = `${shellHint}\n\nPrevious command (try a different approach): ${alt}\n\nTask: ${prompt}`;
  } else {
    userContent = `${shellHint}\n\nTask: ${prompt}`;
  }

  debug(`prompt: ${userContent}`);

  const { text } = await generateText({
    model: provider(config.model),
    system: SYSTEM_PROMPT,
    prompt: userContent,
    temperature: 0.2,
    maxTokens: 512,
  });

  debug(`raw result: ${text}`);
  return text;
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

function stripFences(text) {
  return text
    .split("\n")
    .filter((line) => !line.match(/^```/))
    .join("\n")
    .trim();
}

function cleanForCompletion(text) {
  return stripFences(text).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Shell init scripts (embedded)
// ---------------------------------------------------------------------------

const SHELL_INIT = {
  bash: `# gen tab completion for bash
# Uses bind -x for READLINE_LINE access. Only intercepts "gen " lines.
# No background jobs (bash prints job notifications inside bind -x that
# can't be suppressed), so we use a static indicator instead.

_gen_tab_handler() {
    [[ "$READLINE_LINE" == gen\\ * ]] || return 0
    local prompt="\${READLINE_LINE#gen }"
    [[ -z "$prompt" || "$prompt" == -* ]] && return 0

    # Show a static loading indicator at end of line, hide cursor
    printf '\\033[s \\033[2m…\\033[0m\\033[?25l' >/dev/tty

    local result
    result="$(command gen --complete -- "$prompt" 2>/dev/null)"

    # Clear indicator and restore cursor
    printf '\\033[u\\033[K\\033[?25h' >/dev/tty

    if [[ -n "$result" ]]; then
        READLINE_LINE="$result"
        READLINE_POINT=\${#READLINE_LINE}
    fi
}

bind -x '"\\C-i": _gen_tab_handler'`,

  zsh: `# gen tab completion for zsh
# When the line starts with "gen ", tab replaces the entire line with the
# LLM-generated command. Otherwise falls through to expand-or-complete.

_gen_spinner_start() {
    {
        local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        local i=0
        printf '\\033[?25l' >/dev/tty
        while true; do
            printf '\\033[s \\033[1m%s\\033[0m\\033[u' "\${frames:$i:1}" >/dev/tty
            sleep 0.1
            (( i = (i + 1) % \${#frames} ))
        done
    } &!
    _gen_spinner_pid=$!
}

_gen_spinner_stop() {
    if [[ -n "\${_gen_spinner_pid:-}" ]]; then
        kill "$_gen_spinner_pid" 2>/dev/null
        wait "$_gen_spinner_pid" 2>/dev/null
        _gen_spinner_pid=""
    fi
    printf '\\033[K\\033[?25h' >/dev/tty
}

_gen_do_complete() {
    local prompt="\${BUFFER#gen }"

    # Skip if empty or a flag
    [[ -z "$prompt" || "$prompt" == -* ]] && return 1

    _gen_spinner_start

    local result
    result="$(command gen --complete -- "$prompt" 2>/dev/tty)"

    _gen_spinner_stop

    if [[ -n "$result" ]]; then
        BUFFER="$result"
        CURSOR=\${#BUFFER}
        return 0
    fi
    return 1
}

_gen_tab_dispatch() {
    if [[ "$BUFFER" == gen\\ * ]]; then
        _gen_do_complete || zle expand-or-complete
    else
        zle expand-or-complete
    fi
}

zle -N _gen_tab_dispatch
bindkey '^I' _gen_tab_dispatch`,

  fish: `# gen tab completion for fish
# When the line starts with "gen ", tab replaces the entire line with the
# LLM-generated command. Otherwise falls through to normal completion.

function __gen_spinner_start
    begin
        set -l frames ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
        printf '\\033[?25l' >/dev/tty
        set -l i 1
        while true
            printf '\\033[s \\033[1m%s\\033[0m\\033[u' $frames[$i] >/dev/tty
            sleep 0.1
            set i (math "($i % 10) + 1")
        end
    end &
    set -g __gen_spinner_pid (jobs -lp | tail -1)
end

function __gen_spinner_stop
    if set -q __gen_spinner_pid
        kill $__gen_spinner_pid 2>/dev/null
        wait $__gen_spinner_pid 2>/dev/null
        set -e __gen_spinner_pid
    end
    printf '\\033[K\\033[?25h' >/dev/tty
end

function __gen_do_complete
    set -l buf (commandline -b)
    set -l prompt (string replace -r '^gen\\s+' '' -- "$buf")

    test -z "$prompt"; and return 1
    string match -qr '^-' -- "$prompt"; and return 1

    __gen_spinner_start

    set -l result (command gen --complete -- "$prompt" 2>/dev/tty)

    __gen_spinner_stop

    if test -n "$result"
        commandline -r "$result"
        commandline -f repaint
        return 0
    end

    # Restore original on failure
    commandline -r "gen $prompt"
    commandline -f repaint
    return 1
end

function __gen_tab_handler
    set -l buf (commandline -b)
    if string match -qr '^gen\\s' -- "$buf"
        __gen_do_complete; or commandline -f complete
    else
        commandline -f complete
    end
end

bind \\t __gen_tab_handler`,
};

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function usage() {
  process.stdout.write(`gen - Generate shell commands using an LLM

Usage:
    gen <description>          Generate a command and print to stdout
    gen -y <description>       Generate, display, and execute the command
    gen -x "<command>"         Execute a pre-generated command (used after tab completion)
    gen --complete <words>     Tab-completion helper (internal)

Options:
    -y, --yes                  Execute the generated command immediately
    -x, --exec-display         Execute a pre-generated command (tab completion + enter)
    -h, --help                 Show this help
    -v, --version              Show version

Config:
    Reads from (in order):
      $GEN_CONFIG                 (env var override)
      $XDG_CONFIG_HOME/gen/genrc.json
      ~/.config/gen/genrc.json
      ~/.config/.genrc.json
      ~/.genrc.json

    Config format (JSON):
      {
        "provider": "openai",
        "api_key": "sk-...",
        "model": "gpt-4o-mini",
        "api_url": "https://api.openai.com/v1/chat/completions"
      }

    Use apiKeyHelper to fetch the key from a command (e.g. a secret manager):
      {
        "provider": "openai",
        "apiKeyHelper": "op read 'op://Private/OpenAI/api_key'",
        "model": "gpt-4o-mini"
      }

    Supported providers: openai, anthropic, ollama
    The target shell is auto-detected from your current shell.
    Environment overrides: GEN_API_KEY, GEN_MODEL, GEN_API_URL, GEN_PROVIDER, GEN_SHELL

Tab Completion:
    # bash (add to ~/.bashrc):
    eval "$(gen --shell-init bash)"

    # zsh (add to ~/.zshrc):
    eval "$(gen --shell-init zsh)"

    # fish (add to ~/.config/fish/config.fish):
    gen --shell-init fish | source
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // Quick flags (no config needed)
  if (args.includes("-h") || args.includes("--help")) {
    usage();
    process.exit(0);
  }
  if (args.includes("-v") || args.includes("--version")) {
    process.stdout.write(`gen ${VERSION}\n`);
    process.exit(0);
  }
  if (args.includes("--shell-init")) {
    const shellIdx = args.indexOf("--shell-init");
    const shell = args[shellIdx + 1] || "bash";
    if (!SHELL_INIT[shell]) {
      process.stderr.write(
        `gen: unsupported shell '${shell}' (use bash, zsh, or fish)\n`,
      );
      process.exit(1);
    }
    process.stdout.write(SHELL_INIT[shell] + "\n");
    process.exit(0);
  }

  // Parse flags
  let executeMode = false;
  let execDisplayMode = false;
  let completeMode = false;
  let altPrev = "";
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-y" || arg === "--yes") {
      executeMode = true;
    } else if (arg === "-x" || arg === "--exec-display") {
      execDisplayMode = true;
    } else if (arg === "--complete") {
      completeMode = true;
    } else if (arg === "--alt") {
      altPrev = args[++i] || "";
    } else if (arg === "--") {
      positional.push(...args.slice(i + 1));
      break;
    } else if (arg.startsWith("-")) {
      process.stderr.write(`gen: unknown option '${arg}'\n`);
      process.stderr.write("Try 'gen --help' for more information.\n");
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  const prompt = positional.join(" ");

  debug(
    `mode: execute=${executeMode} exec_display=${execDisplayMode} complete=${completeMode}`,
  );
  debug(`prompt: '${prompt}'`);
  if (altPrev) debug(`alt_prev: '${altPrev}'`);

  // -x mode: execute a pre-generated command
  if (execDisplayMode) {
    if (!prompt) {
      process.stderr.write("gen: no command provided\n");
      process.exit(1);
    }
    debug(`exec-display: '${prompt}'`);
    process.stderr.write(prompt + "\n");
    try {
      execSync(prompt, { stdio: "inherit", shell: true });
    } catch (e) {
      process.exit(e.status || 1);
    }
    process.exit(0);
  }

  if (!prompt) {
    usage();
    process.exit(1);
  }

  // Load config and call LLM
  const config = loadConfig();

  try {
    if (completeMode) {
      const result = cleanForCompletion(await callLLM(config, prompt, altPrev));
      debug(`complete result: '${result}'`);
      process.stdout.write(result);
      process.exit(0);
    }

    const result = stripFences(await callLLM(config, prompt, ""));
    debug(`final result: '${result}'`);

    if (executeMode) {
      debug(`executing: ${result}`);
      process.stderr.write(result + "\n");
      try {
        execSync(result, { stdio: "inherit", shell: true });
      } catch (e) {
        process.exit(e.status || 1);
      }
    } else {
      process.stdout.write(result + "\n");
    }
  } catch (err) {
    debug(`error: ${err.message}`);
    if (err.cause) debug(`cause: ${JSON.stringify(err.cause)}`);
    process.stderr.write(`gen: ${err.message}\n`);
    process.exit(1);
  }
}

main();
