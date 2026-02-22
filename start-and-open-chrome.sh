#!/bin/bash
# Start the Mock Interview Prep app and open it in Google Chrome.
cd "$(dirname "$0")"

if ! command -v npm &>/dev/null; then
  echo "npm not found. Install Node.js (https://nodejs.org) or use nvm, then run this script again."
  exit 1
fi

npm install --silent 2>/dev/null
npm run dev &
DEV_PID=$!
echo "Starting dev server (PID $DEV_PID)..."
sleep 5
open -a "Google Chrome" "http://localhost:3000" 2>/dev/null || open "http://localhost:3000"
echo "Chrome should open to http://localhost:3000"
echo "To stop the server later: kill $DEV_PID"
wait $DEV_PID 2>/dev/null
