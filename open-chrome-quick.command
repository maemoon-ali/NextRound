#!/bin/bash
# Double-click for a FAST start (dev server, no build). Use when you just want to see the app.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! command -v npm &>/dev/null; then
  echo "npm not found. Install Node.js first."
  read -p "Press Enter to close…"
  exit 1
fi

PORT=3000
if [ -n "$(lsof -i :3000 -t 2>/dev/null)" ]; then
  PORT=3001
  [ -n "$(lsof -i :3001 -t 2>/dev/null)" ] && PORT=3022
fi

URL="http://localhost:$PORT"
echo "Starting dev server (no build) at $URL …"
npm run dev -- -p "$PORT" &
PID=$!

echo -n "Waiting for server"
for i in $(seq 1 30); do
  if curl -s -o /dev/null "$URL/" 2>/dev/null; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
  [ "$i" -eq 30 ] && echo " timeout." && kill $PID 2>/dev/null && exit 1
done

echo "Opening Chrome…"
open -a "/Applications/Google Chrome.app" "$URL" 2>/dev/null || open -b com.google.Chrome "$URL" 2>/dev/null || open "$URL"
echo "App: $URL — Keep this window open. Ctrl+C to stop."
wait $PID 2>/dev/null
