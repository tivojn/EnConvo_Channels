#!/bin/bash
# bash has Full Disk Access, so it can read from ~/Downloads.
# node does NOT, so we rsync the project to a non-protected location first.

SOURCE="/Users/zanearcher/Downloads/vibe-coding/enconvo_cli"
MIRROR="$HOME/.local/share/enconvo-telegram-adapter"

mkdir -p "$MIRROR"

# Sync project to non-TCC-protected location (fast after first run)
rsync -a --delete \
  --exclude '.git' \
  --exclude '.claude' \
  "$SOURCE/" "$MIRROR/"

cd "$MIRROR"

# If CLI args provided, run CLI entrypoint; otherwise legacy bot mode
if [ $# -gt 0 ]; then
  exec /opt/homebrew/bin/node node_modules/.bin/tsx src/cli.ts "$@"
else
  exec /opt/homebrew/bin/node node_modules/.bin/tsx src/index.ts
fi
