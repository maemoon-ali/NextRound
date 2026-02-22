#!/bin/bash
# Deploy to localhost and open in a Chrome tab. Double-click to run.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null
[ -s "$HOME/.bash_profile" ] && source "$HOME/.bash_profile" 2>/dev/null

if ! command -v npm &>/dev/null; then
  echo "npm not found. Install Node.js from https://nodejs.org"
  read -p "Press Enter to close…"
  exit 1
fi

# Find a free port so we always start OUR server (avoid hitting an old server).
PORT=""
for p in $(seq 3000 3020); do
  if [ -z "$(lsof -i :$p -t 2>/dev/null)" ]; then
    PORT=$p
    break
  fi
done
if [ -z "$PORT" ]; then
  echo "No free port between 3000-3020. Close other apps or kill processes on those ports and try again."
  read -p "Press Enter to close…"
  exit 1
fi
[ "$PORT" != "3000" ] && echo "Using port $PORT (3000 in use)."

# Homepage at root. Use ?start=1 so Chrome loads it fresh (not a cached /prepare tab).
ROOT_URL="http://localhost:$PORT/?start=1"

echo "=========================================="
echo "  Mock Interview Prep"
echo "=========================================="
echo ""
echo "Building…"
if ! npm run build 2>&1; then
  echo "Build failed."
  read -p "Press Enter to close…"
  exit 1
fi

echo ""
echo "Starting server on port $PORT…"
npm run start -- -p "$PORT" &
PID=$!

echo -n "Waiting for server"
CHECK_URL="http://localhost:$PORT/"
for i in $(seq 1 25); do
  if curl -s -o /dev/null -w "%{http_code}" "$CHECK_URL" 2>/dev/null | grep -q 200; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 25 ]; then
    echo " timeout."
    kill $PID 2>/dev/null
    read -p "Press Enter to close…"
    exit 1
  fi
done

# Verify homepage has start CTA (not job history)
BODY=$(curl -s "$CHECK_URL" 2>/dev/null)
if echo "$BODY" | grep -q "Your job history"; then
  echo "ERROR: Homepage showed job history instead of landing. Fix app routing."
  kill $PID 2>/dev/null
  read -p "Press Enter to close…"
  exit 1
fi
if ! echo "$BODY" | grep -qi "Get started\|START\|Mock Interview Prep"; then
  echo "ERROR: Homepage did not load. Try opening: $ROOT_URL"
  kill $PID 2>/dev/null
  read -p "Press Enter to close…"
  exit 1
fi
echo "Homepage OK (title + start button)."

echo ""
echo "Opening homepage in a new Chrome window…"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -n -a "/Applications/Google Chrome.app" "$ROOT_URL"
else
  open -n -b com.google.Chrome "$ROOT_URL" 2>/dev/null || open "$ROOT_URL"
fi

echo ""
echo "------------------------------------------"
echo "  Homepage: $ROOT_URL"
echo "  Keep this window open. Ctrl+C to stop."
echo "------------------------------------------"
wait $PID 2>/dev/null
