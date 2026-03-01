#!/bin/bash
set -e

PLIST_NAME="com.enconvo.telegram-adapter.plist"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$PROJECT_DIR/$PLIST_NAME"
TARGET="$HOME/Library/LaunchAgents/$PLIST_NAME"
ERROR_LOG="$HOME/Library/Logs/enconvo-telegram-adapter-error.log"

if [ ! -f "$SOURCE" ]; then
    echo "Error: $SOURCE not found"
    exit 1
fi

# Unload existing agent if present
if launchctl list | grep -q "com.enconvo.telegram-adapter"; then
    echo "Stopping existing service..."
    launchctl unload "$TARGET" 2>/dev/null || true
fi

# Clear old error log so we can detect fresh errors
> "$ERROR_LOG" 2>/dev/null || true

# Copy plist to LaunchAgents
mkdir -p "$HOME/Library/LaunchAgents"
cp "$SOURCE" "$TARGET"
echo "Installed plist to $TARGET"

# Load the agent
launchctl load "$TARGET"
echo "Service loaded."

# Wait a moment for the process to start (or fail)
sleep 3

# Check for permission errors
EXIT_CODE=$(launchctl list | grep "com.enconvo.telegram-adapter" | grep -v "application.com" | awk '{print $2}')

if [ "$EXIT_CODE" = "126" ] || [ "$EXIT_CODE" = "1" ]; then
    if grep -qi "EPERM\|operation not permitted\|Operation not permitted" "$ERROR_LOG" 2>/dev/null; then
        echo ""
        echo "⚠  Permission denied — macOS is blocking access to ~/Downloads"
        echo ""
        echo "Opening System Settings → Full Disk Access..."
        echo "Please add /bin/bash to the list and enable it."
        echo ""
        echo "Steps:"
        echo "  1. Click the + button"
        echo "  2. Press Cmd+Shift+G, type: /bin/bash"
        echo "  3. Select 'bash' and click Open"
        echo "  4. Make sure the toggle is ON"
        echo "  5. Then re-run: npm run install-service"
        echo ""
        open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
        exit 1
    fi
fi

# Verify success
PID=$(launchctl list | grep "com.enconvo.telegram-adapter" | grep -v "application.com" | awk '{print $1}')
if [ "$PID" != "-" ] && [ -n "$PID" ]; then
    echo "✓ com.enconvo.telegram-adapter is running (PID: $PID)"
else
    echo "⚠ Service loaded but not yet running (check logs)"
fi

echo ""
echo "Logs: tail -f ~/Library/Logs/enconvo-telegram-adapter.log"
