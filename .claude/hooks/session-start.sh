#!/bin/bash
# Install npm dependencies in fresh Claude Code on the web containers so `npm run check` works.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# `npm install` (not `npm ci`) reuses the cached node_modules from the container snapshot.
npm install --no-audit --no-fund

# Point Playwright and Lighthouse at the container's pre-installed Chromium.
if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
  echo 'export CHROME_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi
