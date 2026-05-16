#!/bin/zsh
cd "/Users/abhinavkatoch/Documents/froogle-reader" || exit 1

if command -v npm >/dev/null 2>&1; then
  npm run launch
else
  /Users/parveenkatoch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/launch.mjs
fi
