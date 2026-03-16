# gen

Generate shell commands from natural language. Just describe what you want and hit `Tab`.

```
$ gen find large files over 100mb⇥
$ find / -type f -size +100M█
```

Your prompt is replaced with a real command — edit it, run it, or hit `Tab` again. No copy-paste, no context switching.


https://github.com/user-attachments/assets/782bf9cf-1bc6-47b9-8106-242b90793c73


## Quick start

```bash
brew tap ryanwilsonperkin/gen https://github.com/ryanwilsonperkin/gen
brew install gen
```

Create `~/.config/gen/genrc.json`:

```json
{
  "provider": "openai",
  "api_key": "sk-...",
  "model": "gpt-4o-mini"
}
```

Enable tab completion (pick your shell):

```bash
# bash (~/.bashrc)
eval "$(gen --shell-init bash)"

# zsh (~/.zshrc)
eval "$(gen --shell-init zsh)"

# fish (~/.config/fish/config.fish)
gen --shell-init fish | source
```

That's it. Type `gen`, describe what you want, press `Tab`.

## Tab completion

This is the main way to use gen. Type a natural language description after `gen` and press `Tab` — the entire line is replaced with the generated command:

```
$ gen for loop 1-5 that echos the number⇥
$ for i in {1..5}; do echo "$i"; done█
```

```
$ gen find all python files modified today⇥
$ find . -name "*.py" -mtime -1█
```

```
$ gen compress src directory into a tarball⇥
$ tar -czf src.tar.gz src█
```

A spinner shows while the LLM is thinking. Once the command appears, you can:

- **Press `Enter`** to run it immediately
- **Edit it** before running — it's just a normal command line
- **Press `Ctrl+C`** to cancel

Tab completion works in **bash**, **zsh**, and **fish**. For other commands, tab falls through to your shell's default completion.

## Other modes

### Print to stdout

Without tab completion enabled, or if you just want the output as text:

```
$ gen list disk usage sorted by size
du -sh * | sort -h
```

Useful for piping:

```bash
gen create a cron entry for every 5 minutes | pbcopy
```

### Execute immediately

```
$ gen -y show my public ip
curl -s ifconfig.me
203.0.113.42
```

The `-y` flag prints the command to stderr (so you can see what ran) and executes it.

## Features

- **Tab completion** — describe what you want, press `Tab`, get a real command
- **Works in bash, zsh, and fish** — with a loading spinner while generating
- **POSIX-compliant** — the core script runs everywhere `/bin/sh` does
- **Multiple providers** — OpenAI, Anthropic, or Ollama (fully local)
- **Auto-detects your shell** — generates commands appropriate for bash, zsh, fish, etc.
- **Minimal dependencies** — just Node.js (uses the [Vercel AI SDK](https://ai-sdk.dev))

## Install

### Homebrew

```bash
brew tap ryanwilsonperkin/gen https://github.com/ryanwilsonperkin/gen
brew install gen
```

### Manual

```bash
curl -fsSL https://raw.githubusercontent.com/ryanwilsonperkin/gen/main/bin/gen -o /usr/local/bin/gen
chmod +x /usr/local/bin/gen
```

## Configuration

Create `~/.config/gen/genrc.json`:

```json
{
  "provider": "openai",
  "api_key": "sk-...",
  "model": "gpt-4o-mini"
}
```

The target shell is auto-detected from your current shell — no need to configure it.

Instead of storing your API key in the config file, you can use `apiKeyHelper` to fetch it from a secret manager or command:

```json
{
  "$schema": "https://raw.githubusercontent.com/ryanwilsonperkin/gen/main/genrc.schema.json",
  "provider": "openai",
  "apiKeyHelper": "op read 'op://Private/OpenAI/api_key'",
  "model": "gpt-4o-mini"
}
```

The command is run and its stdout is used as the API key. Works with 1Password CLI, `aws secretsmanager`, `security find-generic-password`, or any command that prints a key.

Config is loaded from (first match wins):

1. `$GEN_CONFIG` (env var, path to file)
2. `$XDG_CONFIG_HOME/gen/genrc.json`
3. `~/.config/gen/genrc.json`
4. `~/.config/.genrc.json`
5. `~/.genrc.json`

### Providers

| Provider | `provider` | Default model | Notes |
|----------|-----------|---------------|-------|
| OpenAI | `openai` | `gpt-4o-mini` | Requires `api_key` |
| Anthropic | `anthropic` | `claude-sonnet-4-20250514` | Requires `api_key` |
| Ollama | `ollama` | `llama3` | Local, no key needed |

### Environment overrides

Any config value can be overridden with an env var:

- `GEN_API_KEY` — API key
- `GEN_MODEL` — Model name
- `GEN_API_URL` — API endpoint URL
- `GEN_PROVIDER` — Provider name
- `GEN_SHELL` — Override auto-detected shell (e.g. `bash`, `zsh`, `fish`)
- `GEN_CONFIG` — Path to config file

## Debugging

If something isn't working, run with `DEBUG=gen` to see the full request/response flow:

```
$ DEBUG=gen gen list files
  gen config: found /Users/you/.config/gen/genrc.json +0ms
  gen config: provider=openai model=gpt-4o-mini ... +1ms
  gen prompt: Target shell: zsh ... +0ms
  gen raw result: ls +200ms
  gen final result: 'ls' +0ms
ls
```

## License

MIT
