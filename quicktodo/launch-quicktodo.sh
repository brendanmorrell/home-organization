#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.quicktodo-venv"
PY_SCRIPT="$SCRIPT_DIR/launch-quicktodo.py"

# Check if QuickTodo is already running
PID=$(pgrep -f "[Pp]ython.*launch-quicktodo.py")

if [ -n "$PID" ]; then
  # Already running — toggle visibility via Hammerspoon (fast, ~0.2s vs 4s for osascript)
  hs -c '
    local win = hs.window.find("QuickTodo")
    if win then
      local app = win:application()
      if app:isHidden() then
        app:unhide(); win:focus(); win:raise()
      else
        app:hide()
      end
    end
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
