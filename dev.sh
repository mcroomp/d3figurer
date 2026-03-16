#!/usr/bin/env bash
# dev.sh — WSL2 development wrapper for d3figurer
#
# d3figurer is designed to be consumed as an npm package from Linux FS.
# Running directly from /mnt/c/ is too slow (9p mount) and Node.js ESM
# cannot resolve packages via NODE_PATH symlinks on NTFS.
#
# This script:
#   1. Rsyncs source files to ~/d3figurer-dev/ (Linux FS)
#   2. npm installs there if package.json changed
#   3. Runs server.sh or test.sh from ~/d3figurer-dev/
#
# Usage:
#   ./dev.sh test [args]                       run unit tests
#   ./dev.sh start [--src-dir path] [args]     start render server
#   ./dev.sh stop                              stop render server
#   ./dev.sh status                            server status
#   ./dev.sh restart [args]                    restart render server
#   ./dev.sh log                               tail server log
#   ./dev.sh render <figure> <output> [args]   render a figure
#   ./dev.sh batch <outDir> [args]             batch render all figures
#   ./dev.sh check <figure> [args]             layout check
#   ./dev.sh sync                              sync source only (no command)
#
# The --src-dir default is ~/d3figurer-dev/gallery (the synced copy).
# Pass an explicit --src-dir to use a different figures directory.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$HOME/d3figurer-dev"

# ── Sync ────────────────────────────────────────────────────────────────────
sync_source() {
  rsync -a --delete \
    --exclude='node_modules' \
    --exclude='gallery/output' \
    --exclude='.git' \
    "$REPO_DIR/" "$DEV_DIR/"
}

# ── Install ──────────────────────────────────────────────────────────────────
ensure_installed() {
  local lock="$DEV_DIR/node_modules/.install-stamp"
  local pkg="$DEV_DIR/package.json"
  if [ ! -d "$DEV_DIR/node_modules" ] || [ "$pkg" -nt "$lock" ]; then
    echo "dev.sh: npm install..."
    (cd "$DEV_DIR" && npm install --silent)
    touch "$lock"
  fi
}

CMD="${1:-}"

case "$CMD" in
  sync)
    echo "dev.sh: syncing $REPO_DIR → $DEV_DIR"
    sync_source
    echo "dev.sh: synced"
    ;;

  test)
    sync_source
    ensure_installed
    shift
    (cd "$DEV_DIR" && ./test.sh "$@")
    ;;

  start)
    sync_source
    ensure_installed
    shift
    # Default src-dir to the synced gallery unless caller supplies one
    if [[ " $* " != *"--src-dir"* ]]; then
      (cd "$DEV_DIR" && ./server.sh start --src-dir "$DEV_DIR/gallery" "$@")
    else
      (cd "$DEV_DIR" && ./server.sh start "$@")
    fi
    ;;

  stop|status|log|chrome-log)
    # Read-only server ops — no sync needed, DEV_DIR must already exist
    shift
    (cd "$DEV_DIR" && ./server.sh "$CMD" "$@")
    ;;

  restart|ensure-chrome|install)
    sync_source
    ensure_installed
    shift
    (cd "$DEV_DIR" && ./server.sh "$CMD" "$@")
    ;;

  render|batch|check)
    sync_source
    ensure_installed
    shift
    (cd "$DEV_DIR" && node bin/d3figurer.js "$CMD" "$@")
    ;;

  "")
    echo "Usage: ./dev.sh <test|start|stop|restart|status|log|render|batch|check|sync> [args]"
    exit 1
    ;;

  *)
    echo "dev.sh: unknown command '$CMD'"
    exit 1
    ;;
esac
