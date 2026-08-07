#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Clean stdout, structured log:
# - stdout: no timestamps / no metadata
# - log   : ISO8601 timestamp + message + optional trailing [code]
# -----------------------------------------------------------------------------

: "${WBS_LOG_PATH:?WBS_LOG_PATH must be set before sourcing _logging.sh}"
export WBS_LOG_PATH

DEBUG=${DEBUG:=false}

# Are we attached to a terminal?
INTERACTIVE=false
[ -t 1 ] && INTERACTIVE=true

_timestamp() { date -u +"%FT%TZ"; }

# --- one-shot init that rotates the previous file and starts clean -----------
log_init() {
  if [ "${WBS_LOG_INITIALIZED:-}" = "1" ]; then
    return
  fi
  export WBS_LOG_INITIALIZED=1

  mkdir -p "$(dirname "$WBS_LOG_PATH")" 2>/dev/null || true

  if [ -f "$WBS_LOG_PATH" ] && [ -s "$WBS_LOG_PATH" ]; then
    ts=$(date -u +"%Y%m%d-%H%M%S")
    backup="${WBS_LOG_PATH}.${ts}"
    # Prefer mv; fall back to cp if moving across devices fails
    mv -- "$WBS_LOG_PATH" "$backup" 2>/dev/null || {
      cp --preserve=mode,timestamps -- "$WBS_LOG_PATH" "$backup" 2>/dev/null || true
      touch "$WBS_LOG_PATH"
    }
  fi
  touch "$WBS_LOG_PATH"
}

# run init immediately
log_init

# status "Message..." ["status_code"]
# - stdout: "Message..."
# - log   : "2025-08-12T10:00:00Z Message... [status_code]"
status() {
  local message="$1"
  local code="${2:-}"
  if [ -n "$code" ]; then
    printf '%s %s [%s]\n' "$(_timestamp)" "$message" "$code" >> "$WBS_LOG_PATH"
  else
    printf '%s %s\n' "$(_timestamp)" "$message" >> "$WBS_LOG_PATH"
  fi
  if $INTERACTIVE; then
    printf '%s\n' "$message"
  fi
}

# debug "Message..."
# - stdout: shown only if DEBUG=true (clean)
# - log   : "2025-08-12T10:00:00Z Message... [debug]"
debug() {
  printf '%s %s [debug]\n' "$(_timestamp)" "$*" >> "$WBS_LOG_PATH"
  if [ "$DEBUG" = true ]; then
    printf '%s\n' "$*"
  fi
}

_run_logged() {
  local rendered_command="$1"
  shift
  local command_status=0
  printf '%s %s [debug]\n' "$(_timestamp)" "BEGIN RUN: $rendered_command" >> "$WBS_LOG_PATH"

  if $INTERACTIVE && [ "$DEBUG" = true ]; then
    if "$@" 2>&1 | tee -a "$WBS_LOG_PATH"; then
      :
    else
      command_status=$?
    fi
  else
    if "$@" >>"$WBS_LOG_PATH" 2>&1; then
      :
    else
      command_status=$?
    fi
  fi
  printf '\n' >> "$WBS_LOG_PATH"
  printf '%s %s [debug]\n' "$(_timestamp)" "END RUN" >> "$WBS_LOG_PATH"
  return "$command_status"
}

# Execute a command string through Bash. Use only where shell syntax such as a
# pipeline or redirect is required.
run() {
  _run_logged "$*" bash -c "$*"
}

# Execute an argument array without reparsing it through a shell.
run_args() {
  local rendered_command
  printf -v rendered_command '%q ' "$@"
  _run_logged "$rendered_command" "$@"
}
