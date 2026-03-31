#!/bin/bash
# Launch QuickTodo or toggle its visibility if already running.
# Keep this script in the same folder as quicktodo.html and launch-quicktodo.py.
# On first run, creates a hidden .venv and installs pywebview automatically.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.quicktodo-venv"
PY_SCRIPT="$SCRIPT_DIR/launch-quicktodo.py"

# Check if QuickTodo is already running
PID=$(pgrep -f "[Pp]ython.*launch-quicktodo.py")

if [ -n "$PID" ]; then
  # Already running — toggle visibility via AppleScript
  osascript -e '
    tell application "System Events"
      set frontApp to name of first application process whose unix id is '"$PID"'
      set proc to first application process whose unix id is '"$PID"'
      set isVisible to visible of proc
      if isVisible then
        set visible of proc to false
      else
        set visible of proc to true
        set frontmost of proc to true
      end if
    end tell
  '
else
  # Not running — set up venv if needed, then launch
  if [ ! -f "$VENV_DIR/bin/python3" ]; then
    echo "First run — setting up QuickTodo (one-time, ~15 seconds)..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --quiet pywebview
  fi

  exec "$VENV_DIR/bin/python3" "$PY_SCRIPT"
fi
