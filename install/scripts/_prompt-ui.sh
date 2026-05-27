#!/usr/bin/env bash
set -euo pipefail

# prompt_ui.sh
# Clean prompts with readline (-p), one-line errors, no blank gaps, safe backspace.

# --- minimal ANSI helpers ---
_ui_up_1=$'\033[1A'
_ui_cr=$'\r'
_ui_el=$'\033[2K'

# check for -i prefill support
_ui_has_read_i=false
if help read 2>/dev/null | grep -q ' -i '; then
  _ui_has_read_i=true
fi

# Read wrapper. Caller must set: _ui_prompt_text
# Stores result in _UI_READ. DOES NOT move the cursor or print newlines.
_ui_read() {              # $1=prefill, $2="-s" or ""
  local _prefill="${1:-}" _secret="${2:-}"
  _UI_READ=""
  if $_ui_has_read_i; then
    if [[ "$_secret" == "-s" ]]; then
      builtin read -e -s -i "$_prefill" -p "$_ui_prompt_text" _UI_READ
    else
      builtin read -e    -i "$_prefill" -p "$_ui_prompt_text" _UI_READ
    fi
  else
    if [[ "$_secret" == "-s" ]]; then
      builtin read -e -s -p "$_ui_prompt_text" _UI_READ
    else
      builtin read -e    -p "$_ui_prompt_text" _UI_READ
    fi
    [[ -z "$_UI_READ" ]] && _UI_READ="${_prefill}"
  fi
}

# Show/refresh error on the current line (assumes we're already on that line)
_ui_show_error() {        # $1=msg
  printf "%s%s%s" "$_ui_cr" "$_ui_el" "$1"
}

# Clear the current line (error line)
_ui_clear_current_line() {
  printf "%s%s" "$_ui_cr" "$_ui_el"
}

# Move to prompt line and clear it (used before re-prompt on error)
_ui_up_and_clear_prompt_line() {
  printf "%s%s%s" "$_ui_up_1" "$_ui_cr" "$_ui_el"
}

# ---------- public API ----------

# usage: ui_prompt_until VAR "Prompt text" validator_fn [allow_blank=false]
ui_prompt_until() {
  local __var="$1" __prompt="$2" __validator="$3" __allow_blank="${4:-false}"
  local v prev="${!__var:-}" err=false

  if [[ -t 0 ]]; then
    while :; do
      # Prompt & read (non-secret). After Enter, terminal is already on the next line.
      _ui_prompt_text="📝 ${__prompt}: "
      _ui_read "$prev" ""
      v="${_UI_READ}"

      if [[ -z "$v" && "$__allow_blank" == "true" ]]; then
        printf -v "$__var" '%s' ""
        export "${__var?}"
        $err && _ui_clear_current_line   # clear the error row; stay here for next prompt
        return 0
      fi

      if "$__validator" "$v"; then
        printf -v "$__var" '%s' "$v"
        export "${__var?}"
        $err && _ui_clear_current_line
        return 0
      fi

      # invalid: we are on the line *below* the prompt already; show/refresh error, then go up & clear prompt
      _ui_show_error "⚠️  Invalid value. Please try again."
      _ui_up_and_clear_prompt_line
      err=true
      prev="$v"
      # loop continues; next iteration will repaint the prompt cleanly
    done
  else
    v="${!__var:-}"
    if [[ -z "$v" && "$__allow_blank" == "true" ]]; then
      printf -v "$__var" '%s' ""
      export "${__var?}"; return 0
    fi
    if "$__validator" "$v"; then
      printf -v "$__var" '%s' "$v"
      export "${__var?}"; return 0
    fi
    echo "❌ ${__var} is invalid in non-interactive mode" >&2
    return 1
  fi
}

# usage: ui_prompt_secret VAR "Prompt text" [minlen=0]
# Behavior:
# - No prefill for secrets (always empty buffer each attempt).
# - On invalid: draw/refresh error one line below; then go back up and fully clear the prompt line.
# - On success:
#     - if no prior error -> move down exactly one line (no blank spacer)
#     - if prior error    -> move down, clear that error line (no blank spacer)
# usage: ui_prompt_secret VAR "Prompt text" [minlen=0]
# usage: ui_prompt_secret VAR "Prompt text" [minlen=0]
ui_prompt_secret() {
  local __var="$1" __prompt="$2" __minlen="${3:-0}"
  local v err=false

  if [[ -t 0 ]]; then
    while :; do
      _ui_prompt_text="📝 ${__prompt}: "
      # Secrets: never prefill; read -s. IMPORTANT: do NOT print any newline here.
      _ui_read "" "-s"
      v="${_UI_READ}"

      # ---- valid (blank allowed) ----
      if [[ -z "$v" || ${#v} -ge $__minlen ]]; then
        printf -v "$__var" '%s' "$v"
        export "${__var?}"
        if $err; then
          # We are on the error line now; clear it and leave cursor here.
          _ui_clear_current_line
        fi
        return 0
      fi

      # ---- invalid ----
      # We're already on the line below the prompt; show/refresh error there,
      # then go back up and clear the prompt line so next loop repaints cleanly.
      _ui_show_error "⚠️  Minimum length is ${__minlen}. Try again."
      _ui_up_and_clear_prompt_line
      err=true
      # loop continues; next iteration prints a single clean prompt (no prefill)
    done
  else
    v="${!__var:-}"
    if [[ -n "$v" && ${#v} -lt $__minlen ]]; then
      echo "❌ ${__var} too short (min ${__minlen}) in non-interactive mode" >&2
      return 1
    fi
    printf -v "$__var" '%s' "$v"
    export "${__var?}"
    return 0
  fi
}

# usage: ui_prompt_masked VAR "Prompt text" [minlen=0]
# Mirrors ui_prompt_until behavior exactly; shows '*' per character.
# usage: ui_prompt_masked VAR "Prompt text" [minlen=0]
ui_prompt_masked() {
  local __var="$1" __prompt="$2" __minlen="${3:-0}"
  local v err=false ch

  if [[ -t 0 ]]; then
    while :; do
      v=""
      # Print prompt (no readline; we handle input/masking)
      printf "📝 %s: " "$__prompt"

      # Read one char at a time; -r raw, -s silent, -n1 one byte
      while IFS= read -rsn1 ch; do
        case "$ch" in
          $'\r'|$'\n'|$'\0')       # Enter (CR, LF) or rare NUL — treat all as submit
            printf "\r\n"          # force CRLF so we always advance to the next line
            break
            ;;
          $'\003')                 # Ctrl-C
            printf "\r\n"
            return 130
            ;;
          $'\177'|$'\b')           # Backspace (DEL or BS)
            if [[ -n "$v" ]]; then
              v=${v%?}
              printf '\b \b'
            fi
            ;;
          *)
            # Skip other control chars (keeps things clean on weird TTYs)
            if [[ "$ch" < ' ' ]]; then
              continue
            fi
            v+="$ch"
            printf '*'
            ;;
        esac
      done

      # ---- validate (match ui_prompt_until behavior) ----
      if [[ -z "$v" || ${#v} -ge $__minlen ]]; then
        printf -v "$__var" '%s' "$v"
        export "$__var"
        if $err; then
          # We're sitting on the error line: clear it and leave cursor here
          printf "\r\033[2K"
        fi
        return 0
      fi

      # ---- invalid ----
      # We are on the line below the prompt now; show/refresh error, then go up & clear prompt
      printf "\r\033[2K"
      printf "⚠️  Minimum length is %s. Try again." "$__minlen"
      printf "\033[1A\r\033[2K"
      err=true
      # Loop continues; next iteration prints a single clean prompt (no prefill)
    done
  else
    # Non-interactive: enforce minlen if provided
    local envv="${!__var:-}"
    if [[ -n "$envv" && ${#envv} -lt $__minlen ]]; then
      echo "❌ ${__var} too short (min ${__minlen}) in non-interactive mode" >&2
      return 1
    fi
    printf -v "$__var" '%s' "$envv"
    export "$__var"
    return 0
  fi
}

# usage: ui_yes_no VAR "Prompt text" [default=Y]
# Emits exactly one newline at end.
ui_yes_no() {
  local __var="$1" __prompt="$2" __def="${3:-Y}" a
  if [[ -t 0 ]]; then
    local alt; alt="$( [[ "$__def" =~ ^[Yy]$ ]] && echo n || echo Y )"
    builtin read -r -p "📝 ${__prompt} [${__def}/${alt}]: " a
    printf "\n"
    case "${a:-$__def}" in
      [Yy]* ) printf -v "$__var" '%s' true ;;
      [Nn]* ) printf -v "$__var" '%s' false ;;
      *     ) printf -v "$__var" '%s' "$( [[ "$__def" =~ ^[Yy]$ ]] && echo true || echo false )" ;;
    esac
    export "${__var?}"
  else
    a="${!__var:-$__def}"
    case "$a" in
      [Yy]* ) printf -v "$__var" '%s' true ;;
      [Nn]* ) printf -v "$__var" '%s' false ;;
      *     ) printf -v "$__var" '%s' "$( [[ "$__def" =~ ^[Yy]$ ]] && echo true || echo false )" ;;
    esac
    export "${__var?}"
  fi
}

# ---------- helpers & validators ----------

ui_generate_password() {
  openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 10
}

ui_valid_email() {
  local e="${1:-}"
  [[ "$e" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]
}

_ui_syntax_host() {
  [[ "${1:-}" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]]
}

_ui_resolve_ipv4s() {
  local h="${1:-}" ips=""
  if command -v getent >/dev/null 2>&1; then
    ips="$(getent ahostsv4 "$h" 2>/dev/null | awk '{print $1}' | sort -u)"
  elif command -v dig >/dev/null 2>&1; then
    ips="$(dig +short A "$h" 2>/dev/null | sort -u)"
  elif command -v host >/dev/null 2>&1; then
    ips="$(host -t A "$h" 2>/dev/null | awk '/has address/ {print $4}' | sort -u)"
  fi
  [[ -n "$ips" ]] && printf "%s\n" "$ips"
}

# Requires $SERVER_IP for non-.test hosts
ui_host_is_valid() {
  local h="${1:-}"
  [[ -z "$h" ]] && return 1
  [[ "$h" == "localhost" ]] && return 1
  _ui_syntax_host "$h" || return 1

  # allow *.test only if LOCALHOST=true
  [[ "$h" =~ \.test$ && "${LOCALHOST:-}" == "true" ]] && return 0

  # if $SERVER_IP is available check if the host resolves to $SERVER_IP
  [[ -z "${SERVER_IP:-}" ]] && return 1
  local ips; ips="$(_ui_resolve_ipv4s "$h" || true)"
  [[ -z "$ips" ]] && return 1
  grep -Fxq "$SERVER_IP" <<<"$ips"
}
