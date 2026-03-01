#!/bin/bash
set -e

PLIST_NAME="com.enconvo.telegram-adapter.plist"
TARGET="$HOME/Library/LaunchAgents/$PLIST_NAME"

if [ -f "$TARGET" ]; then
    echo "Stopping service..."
    launchctl unload "$TARGET" 2>/dev/null || true
    rm "$TARGET"
    echo "Removed $TARGET"
else
    echo "No installed service found at $TARGET"
fi

# Verify
if launchctl list | grep -q "com.enconvo.telegram-adapter"; then
    echo "⚠ Service still appears in launchctl list"
else
    echo "✓ Service removed successfully"
fi
