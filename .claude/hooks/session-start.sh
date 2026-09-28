#!/bin/bash
# Install npm dependencies in fresh Claude Code on the web containers so `npm run check` works.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# `npm install` (not `npm ci`) reuses the cached node_modules from the container snapshot.
npm install --no-audit --no-fund
