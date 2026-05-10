#!/bin/zsh
cd "/Users/parveenkatoch/Documents/Codex/2026-05-08/use-this-prompt-txt-build-an" || exit 1

if command -v npm >/dev/null 2>&1; then
  npm run launch
else
  /Users/parveenkatoch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/launch.mjs
fi
