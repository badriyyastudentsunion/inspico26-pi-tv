#!/bin/bash
# Raspberry Pi 5 Launch Script for Art Gallery TV Display
# Starts the local server and opens Chromium in Kiosk Fullscreen Mode

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "Starting Art Gallery Pi Server..."
node server.js &
SERVER_PID=$!

sleep 2

echo "Launching Chromium in TV Kiosk Mode..."
# Flags ensure camera access works smoothly and no unwanted bubble popups appear on the TV
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --check-for-update-interval=31536000 \
  --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --enable-features=BarcodeDetector \
  --enable-experimental-web-platform-features \
  http://localhost:3000

# Cleanup server when browser closes
kill $SERVER_PID
