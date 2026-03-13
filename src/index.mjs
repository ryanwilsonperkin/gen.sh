import { execSync } from "node:child_process";
import { debug } from "./debug.mjs";
import { loadConfig } from "./config.mjs";
import { callLLM, stripFences, cleanForCompletion } from "./llm.mjs";
import { SHELL_INIT } from "./completions.mjs";

const VERSION = "0.2.0";

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
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {
    executeMode: false,
    execDisplayMode: false,
    completeMode: false,
    altPrev: "",
  };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-y" || arg === "--yes") {
      flags.executeMode = true;
    } else if (arg === "-x" || arg === "--exec-display") {
      flags.execDisplayMode = true;
    } else if (arg === "--complete") {
      flags.completeMode = true;
    } else if (arg === "--alt") {
      flags.altPrev = argv[++i] || "";
    } else if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    } else if (arg.startsWith("-")) {
      process.stderr.write(`gen: unknown option '${arg}'\n`);
      process.stderr.write("Try 'gen --help' for more information.\n");
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  return { ...flags, prompt: positional.join(" ") };
}

// ---------------------------------------------------------------------------
// Command execution helper
// ---------------------------------------------------------------------------

function execCommand(cmd) {
  try {
    execSync(cmd, { stdio: "inherit", shell: true });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(argv = process.argv.slice(2)) {
  // Quick flags (no config needed)
  if (argv.includes("-h") || argv.includes("--help")) {
    usage();
    process.exit(0);
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write(`gen ${VERSION}\n`);
    process.exit(0);
  }
  if (argv.includes("--shell-init")) {
    const shell = argv[argv.indexOf("--shell-init") + 1] || "bash";
    if (!SHELL_INIT[shell]) {
      process.stderr.write(
        `gen: unsupported shell '${shell}' (use bash, zsh, or fish)\n`,
      );
      process.exit(1);
    }
    process.stdout.write(SHELL_INIT[shell] + "\n");
    process.exit(0);
  }

  const { executeMode, execDisplayMode, completeMode, altPrev, prompt } =
    parseArgs(argv);

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
    execCommand(prompt);
    process.exit(0);
  }

  if (!prompt) {
    usage();
    process.exit(1);
  }

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
      execCommand(result);
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
