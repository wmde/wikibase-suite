#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Clean stdout, structured log:
# - stdout: no timestamps / no [LEVEL]
# - log   : ISO8601 timestamp + [LEVEL]
# -----------------------------------------------------------------------------

export LOG_PATH=${LOG_PATH:=/tmp/wbs-deploy-setup.log}

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

  mkdir -p "$(dirname "$LOG_PATH")" 2>/dev/null || true

  if [ -f "$LOG_PATH" ] && [ -s "$LOG_PATH" ]; then
    ts=$(date -u +"%Y%m%d-%H%M%S")
    backup="${LOG_PATH}.${ts}"
    # Prefer mv; fall back to cp if moving across devices fails
    mv -- "$LOG_PATH" "$backup" 2>/dev/null || {
      cp --preserve=mode,timestamps -- "$LOG_PATH" "$backup" 2>/dev/null || true
      touch "$LOG_PATH"
    }
  fi
  touch "$LOG_PATH"
}

# run init immediately
log_init

# status "Message..."
# - stdout: "Message..."
# - log   : "2025-08-12T10:00:00Z [status] Message..."
status() {
  printf '%s [status] %s\n' "$(_timestamp)" "$*" >> "$LOG_PATH"
  if $INTERACTIVE; then
    printf '%s\n' "$*"
  fi
}

# debug "Message..."
# - stdout: shown only if DEBUG=true (clean)
# - log   : "2025-08-12T10:00:00Z [debug] Message..."
debug() {
  printf '%s [debug] %s\n' "$(_timestamp)" "$*" >> "$LOG_PATH"
  if [ "$DEBUG" = true ]; then
    printf '%s\n' "$*"
  fi
}

# run "command string"
# Always logs. Mirrors to stdout only if INTERACTIVE && DEBUG.
# Log format:
#   2025-... [debug] $ command string
#   <raw command output...>
run() {
  local cmd="$*"
  printf '%s [debug] $ %s\n' "$(_timestamp)" "BEGIN RUN: $cmd" >> "$LOG_PATH"

  if $INTERACTIVE && [ "$DEBUG" = true ]; then
    # output to screen and log
    bash -c "$cmd" 2>&1 | tee -a "$LOG_PATH"
  else
    # log only
    bash -c "$cmd" >>"$LOG_PATH" 2>&1
  fi
  printf '%s [debug] $ %s\n' "$(_timestamp)" "END RUN" >> "$LOG_PATH"
}
