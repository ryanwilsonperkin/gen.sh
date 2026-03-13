import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { debug } from "./debug.mjs";

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
      const baseURL =
        config.apiUrl?.replace(/\/api\/chat$/, "") ||
        "http://localhost:11434";
      return createOpenAI({
        baseURL: `${baseURL}/v1`,
        apiKey: "ollama",
      });
    }
    default:
      process.stderr.write(`gen: unsupported provider '${config.provider}'\n`);
      process.exit(1);
  }
}

export async function callLLM(config, prompt, alt) {
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

export function stripFences(text) {
  return text
    .split("\n")
    .filter((line) => !line.match(/^```/))
    .join("\n")
    .trim();
}

export function cleanForCompletion(text) {
  return stripFences(text).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}
