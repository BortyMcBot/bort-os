#!/usr/bin/env bash
set -euo pipefail

export CHROME_BINARY=/usr/bin/google-chrome-stable

ENV_FILE="$HOME/.pinchtab/.env"
PID_FILE="/tmp/pinchtab.pid"
HEALTH_URL="http://127.0.0.1:9867/health"
TIMEOUT_SEC=15

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${BRIDGE_TOKEN:-}" ]]; then
  echo "BRIDGE_TOKEN not set in $ENV_FILE" >&2
  exit 1
fi

health_check() {
  curl -s --connect-timeout 2 --max-time 5 -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${BRIDGE_TOKEN}" "$HEALTH_URL"
}

is_pid_alive() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" >/dev/null 2>&1
}

cmd_start() {
  if [[ -f "$PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if is_pid_alive "$existing_pid"; then
      local code
      code="$(health_check || true)"
      if [[ "$code" == "200" ]]; then
        echo "Pinchtab already running (pid=$existing_pid, health=200)"
        exit 0
      fi
      echo "Pinchtab running (pid=$existing_pid) but health=$code; continuing"
    else
      rm -f "$PID_FILE"
    fi
  fi

  echo "Starting pinchtab..."
  pinchtab serve >/tmp/pinchtab.log 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  local start_time
  start_time=$(date +%s)
  while true; do
    local code
    code="$(health_check || true)"
    if [[ "$code" == "200" ]]; then
      echo "Pinchtab healthy (pid=$pid, health=200)"
      exit 0
    fi
    local now
    now=$(date +%s)
    if (( now - start_time >= TIMEOUT_SEC )); then
      echo "Timed out waiting for pinchtab health (last=$code)" >&2
      exit 1
    fi
    sleep 0.5
  done
}

cmd_stop() {
  if [[ ! -f "$PID_FILE" ]]; then
    echo "Pinchtab not running (no pid file)"
    exit 0
  fi
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    rm -f "$PID_FILE"
    echo "Pinchtab pid file empty; removed"
    exit 0
  fi
  if is_pid_alive "$pid"; then
    echo "Stopping pinchtab (pid=$pid)..."
    kill "$pid" || true
  else
    echo "Pinchtab pid not alive; cleaning up"
  fi
  rm -f "$PID_FILE"
  echo "Pinchtab stopped"
}

cmd_status() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if is_pid_alive "$pid"; then
      local code
      code="$(health_check || true)"
      echo "Pinchtab running (pid=$pid, health=$code)"
      exit 0
    fi
    echo "Pinchtab pid file exists but process not running"
    exit 1
  else
    echo "Pinchtab not running"
    exit 1
  fi
}

case "${1:-}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  *)
    echo "Usage: $0 start|stop|status" >&2
    exit 2
    ;;
 esac
