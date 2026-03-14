#!/usr/bin/env bash
# server.sh — d3figurer render server lifecycle manager
#
# Requires NODE_PATH to already be set in the environment pointing to a
# node_modules directory that contains puppeteer, jsdom, d3, etc.
# The caller (e.g. compile-figures.sh) is responsible for setting NODE_PATH.
#
# PID files and logs go in --run-dir (default: ~/.d3figurer/run, or
# $D3FIGURER_RUN_DIR).  Everything else is resolved from NODE_PATH.
#
# Commands:
#   ./server.sh install                              install node_modules + Chrome
#   ./server.sh ensure-chrome                        verify/download Chrome only
#   ./server.sh start   [--src-dir path] [--port N] [--run-dir path]
#   ./server.sh stop    [--run-dir path]
#   ./server.sh restart [--src-dir path] [--run-dir path]
#   ./server.sh status  [--run-dir path]
#   ./server.sh log     [--run-dir path]
#   ./server.sh chrome-log [--run-dir path]

set -euo pipefail

FIGURER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=9229
CHROME_PORT=9230
SRC_DIR=""

# ── Parse args ────────────────────────────────────────────────────────────────
cmd="${1:-help}"
shift || true

RUN_DIR="${D3FIGURER_RUN_DIR:-$HOME/.d3figurer/run}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --src-dir) SRC_DIR="$2"; shift 2 ;;
    --port)    PORT="$2";    shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

PID_FILE="$RUN_DIR/d3figurer.pid"
LOG_FILE="$RUN_DIR/d3figurer.log"
CHROME_PID_FILE="$RUN_DIR/chrome.pid"
CHROME_LOG="$RUN_DIR/chrome.log"

# ── Helpers ───────────────────────────────────────────────────────────────────
is_running()      { [ -f "$PID_FILE" ]        && kill -0 "$(cat "$PID_FILE")"        2>/dev/null; }
chrome_is_running(){ [ -f "$CHROME_PID_FILE" ] && kill -0 "$(cat "$CHROME_PID_FILE")" 2>/dev/null; }

# Find any d3figurer-server process not tracked by PID_FILE.
# Returns PIDs (newline-separated) or empty string.
find_orphan_server() {
  local pf_pid=""
  [ -f "$PID_FILE" ] && pf_pid="$(cat "$PID_FILE" 2>/dev/null)"
  # pgrep uses ERE; plain substring match is enough
  pgrep -f "d3figurer-server.js" 2>/dev/null \
    | grep -v "^${pf_pid}$" || true
}

# Send SIGTERM, wait up to 5s, then SIGKILL if still alive.
kill_gracefully() {
  local pid="$1"
  kill -TERM "$pid" 2>/dev/null || return 0
  for _ in $(seq 1 10); do
    sleep 0.5
    kill -0 "$pid" 2>/dev/null || return 0
  done
  kill -KILL "$pid" 2>/dev/null || true
}
server_ready()    { curl -s "http://localhost:$PORT/" 2>/dev/null | grep -q '"ready":true'; }
chrome_ready()    { curl -s "http://127.0.0.1:$CHROME_PORT/json/version" 2>/dev/null | grep -q '"Browser"'; }

find_chrome() {
  # Ask puppeteer via the inherited NODE_PATH — works wherever modules live
  node --no-warnings -e \
    "try{const p=require('puppeteer');const e=p.executablePath();if(e)process.stdout.write(e)}catch(e){}" \
    2>/dev/null || true
  # Fallback: scan puppeteer's default cache
  if [ -z "$(find_chrome_above)" ]; then
    find "$HOME/.cache/puppeteer" -name "chrome" -type f 2>/dev/null | head -1 || true
  fi
}
find_chrome_above() {
  node --no-warnings -e \
    "try{const p=require('puppeteer');const e=p.executablePath();if(e)process.stdout.write(e)}catch(e){}" \
    2>/dev/null || true
}

# ── Commands ──────────────────────────────────────────────────────────────────
case "$cmd" in

  start)
    if is_running; then
      echo "Already running (PID $(cat "$PID_FILE"))"
      exit 0
    fi

    # Clean up stale PID file from a crashed/killed previous run
    if [ -f "$PID_FILE" ]; then
      echo "Removing stale PID file (process $(cat "$PID_FILE") is gone)"
      rm -f "$PID_FILE"
    fi
    # Kill any orphaned process occupying the port
    ORPHANS="$(find_orphan_server)"
    if [ -n "$ORPHANS" ]; then
      echo "Killing orphaned server process(es): $ORPHANS"
      for opid in $ORPHANS; do kill_gracefully "$opid"; done
    fi

    mkdir -p "$RUN_DIR"

    # ── Step 1: ensure Chrome is running ──────────────────────────────────
    if ! chrome_is_running; then
      CHROME_EXE="$(find_chrome)"
      if [ ! -x "$CHROME_EXE" ]; then
        "$0" ensure-chrome
        CHROME_EXE="$(find_chrome)"
      fi
      if [ ! -x "$CHROME_EXE" ]; then
        echo "Chrome not found. Ensure NODE_PATH is set and puppeteer is installed."
        exit 1
      fi
      echo "Starting Chrome (remote-debug on :$CHROME_PORT)..."
      "$CHROME_EXE" \
        --headless=new --no-sandbox --disable-setuid-sandbox \
        --disable-dev-shm-usage \
        --remote-debugging-port="$CHROME_PORT" \
        --remote-debugging-address=127.0.0.1 \
        --no-first-run --no-default-browser-check \
        > "$CHROME_LOG" 2>&1 &
      echo $! > "$CHROME_PID_FILE"
      for i in $(seq 1 20); do
        sleep 0.5
        if chrome_ready; then break; fi
      done
      if ! chrome_ready; then
        echo "Chrome failed to start. Check: $CHROME_LOG"
        rm -f "$CHROME_PID_FILE"
        exit 1
      fi
      echo "Chrome ready."
    else
      echo "Chrome already running (PID $(cat "$CHROME_PID_FILE"))."
    fi

    # ── Step 2: start render server (NODE_PATH inherited from environment) ─
    echo "Starting d3figurer render server..."
    RESOLVED_SRC_DIR=""
    if [ -n "$SRC_DIR" ]; then
      RESOLVED_SRC_DIR="$(realpath "$SRC_DIR")"
    fi

    CHROME_URL="http://127.0.0.1:$CHROME_PORT" \
    D3FIGURER_SRC_DIR="$RESOLVED_SRC_DIR" \
      node "$FIGURER_DIR/bin/d3figurer-server.js" "$PORT" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "PID $(cat "$PID_FILE") — waiting for ready..."
    for i in $(seq 1 30); do
      sleep 1
      if server_ready; then echo "Ready in ${i}s"; exit 0; fi
      if ! is_running; then
        echo "Server crashed. Last log lines:"
        tail -20 "$LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
      fi
    done
    echo "Server taking longer than expected — check: $LOG_FILE"
    ;;

  stop)
    # Gracefully stop tracked server process
    if is_running; then
      curl -s -X DELETE "http://localhost:$PORT/" >/dev/null 2>&1 || true
      kill_gracefully "$(cat "$PID_FILE")"
    fi
    rm -f "$PID_FILE"
    # Also kill any orphaned server processes not tracked by the PID file
    ORPHANS="$(find_orphan_server)"
    if [ -n "$ORPHANS" ]; then
      echo "Killing orphaned server process(es): $ORPHANS"
      for opid in $ORPHANS; do kill_gracefully "$opid"; done
    fi
    # Stop Chrome
    if chrome_is_running; then
      kill_gracefully "$(cat "$CHROME_PID_FILE")"
    fi
    rm -f "$CHROME_PID_FILE"
    echo "Stopped"
    ;;

  restart)
    if is_running; then
      curl -s -X DELETE "http://localhost:$PORT/" >/dev/null 2>&1 || true
      kill_gracefully "$(cat "$PID_FILE")"
      rm -f "$PID_FILE"
    fi
    ORPHANS="$(find_orphan_server)"
    if [ -n "$ORPHANS" ]; then
      for opid in $ORPHANS; do kill_gracefully "$opid"; done
    fi
    EXTRA="--run-dir $RUN_DIR"
    if [ -n "$SRC_DIR" ]; then EXTRA="$EXTRA --src-dir $SRC_DIR"; fi
    exec "$0" start $EXTRA
    ;;

  status)
    if chrome_is_running; then
      chrome_status="Chrome on :$CHROME_PORT (PID $(cat "$CHROME_PID_FILE"))"
    else
      chrome_status="Chrome not running"
    fi
    if is_running; then
      pid=$(cat "$PID_FILE")
      if server_ready; then
        echo "Running — PID $pid, ready on :$PORT | $chrome_status"
      else
        echo "Running — PID $pid, still starting... | $chrome_status"
      fi
    else
      echo "Not running | $chrome_status"
    fi
    ;;

  log)
    [ -f "$LOG_FILE" ] && tail -f "$LOG_FILE" || echo "No log yet: $LOG_FILE"
    ;;

  chrome-log)
    [ -f "$CHROME_LOG" ] && tail -f "$CHROME_LOG" || echo "No log yet: $CHROME_LOG"
    ;;

  install)
    # Install node_modules into the d3figurer directory.
    # Used by setup_mcp.sh when d3figurer is a cloned repo (not an npm package).
    # Chrome is downloaded on first `start` — no need to pre-install it here.
    echo "Installing node_modules in $FIGURER_DIR..."
    (cd "$FIGURER_DIR" && npm install)
    ;;

  ensure-chrome)
    # Verify Chrome is installed and executable; download via puppeteer if not.
    # Requires NODE_PATH to point to a node_modules that contains puppeteer,
    # OR puppeteer must be installed in $FIGURER_DIR/node_modules.
    # Safe to call repeatedly — no-op when Chrome is already healthy.
    CHROME_EXE="$(find_chrome)"
    if [ -x "$CHROME_EXE" ]; then
      echo "Chrome ok: $CHROME_EXE"
      exit 0
    fi
    echo "Chrome not found or not executable — installing via puppeteer..."
    PUPPETEER_CLI=""
    for dir in $(echo "${NODE_PATH:-}" | tr ':' '\n') "$FIGURER_DIR/node_modules"; do
      if [ -x "$dir/.bin/puppeteer" ]; then
        PUPPETEER_CLI="$dir/.bin/puppeteer"
        break
      fi
    done
    if [ -z "$PUPPETEER_CLI" ]; then
      echo "ERROR: puppeteer CLI not found. Ensure NODE_PATH is set to a node_modules with puppeteer."
      exit 1
    fi
    "$PUPPETEER_CLI" browsers install chrome
    ;;

  help|--help|-h)
    echo "Usage: ./server.sh <command> [options]"
    echo ""
    echo "  install                    install node_modules + Chrome (first-time setup)"
    echo "  ensure-chrome              verify Chrome is installed; download if missing"
    echo "  start   [--src-dir path]   start Chrome + render server"
    echo "  stop                       graceful stop (render server + Chrome)"
    echo "  restart [--src-dir path]   restart render server only (Chrome stays warm)"
    echo "  status                     check if running and ready"
    echo "  log                        tail render server log"
    echo "  chrome-log                 tail Chrome log"
    echo ""
    echo "Options:"
    echo "  --src-dir <path>   directory containing figure modules"
    echo "  --port <n>         HTTP port (default: 9229)"
    echo "  --run-dir <path>   PID/log directory (default: ~/.d3figurer/run)"
    echo ""
    echo "Environment:"
    echo "  NODE_PATH          must point to node_modules containing puppeteer, d3, jsdom, etc."
    echo "  D3FIGURER_RUN_DIR  override default run directory"
    ;;

  *)
    echo "Unknown command: $cmd"
    echo "Run './server.sh help' for usage"
    exit 1
    ;;
esac
