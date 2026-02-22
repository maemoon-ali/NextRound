#!/bin/bash
# Build, start the server, and open the app in Chrome.
cd "$(dirname "$0")"

if ! command -v npm &>/dev/null; then
  echo "npm not found. Install Node.js from https://nodejs.org then run this again."
  exit 1
fi

PORT=3000
if [ -n "$(lsof -i :3000 -t 2>/dev/null)" ]; then
  echo "Port 3000 is in use. Using 3022 instead."
  PORT=3022
fi

echo "Building the app…"
npm run build 2>&1 || exit 1

echo "Starting server on port $PORT…"
npm run start -- -p "$PORT" &
PID=$!
sleep 4

for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" | grep -q 200; then break; fi
  sleep 1
  [ "$i" -eq 20 ] && echo "Server did not start." && kill $PID 2>/dev/null && exit 1
done

URL="http://localhost:$PORT/"
CHROME_OPENED=
if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "/Applications/Google Chrome.app" "$URL" 2>/dev/null && CHROME_OPENED=1
fi
if [ -z "$CHROME_OPENED" ]; then
  open -b com.google.Chrome "$URL" 2>/dev/null && CHROME_OPENED=1
fi
if [ -z "$CHROME_OPENED" ]; then
  open -a "Google Chrome" "$URL" 2>/dev/null && CHROME_OPENED=1
fi
if [ -n "$CHROME_OPENED" ]; then
  echo "Opened $URL in Google Chrome."
else
  open "$URL"
  echo "Opened $URL in your default browser."
fi

echo "Server at $URL (PID $PID). To stop: kill $PID"
wait $PID 2>/dev/null
