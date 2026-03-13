export const SHELL_INIT = {
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
