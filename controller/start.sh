#!/usr/bin/env bash
# Usage: ./start.sh [screen_number]   (screen 1 = primary; try 2 for the projector)
# Env: VLC_PASSWORD (default farewell), VLC_PORT (8080), PORT (3000), VLC_BIN
cd "$(dirname "$0")" || exit 1
SCREEN="${1:-${SCREEN:-1}}"
export VLC_PASSWORD="${VLC_PASSWORD:-farewell}"
export VLC_PORT="${VLC_PORT:-8080}"
if [ -z "$VLC_BIN" ]; then
  if command -v vlc >/dev/null 2>&1; then VLC_BIN=vlc
  elif [ -x "/Applications/VLC.app/Contents/MacOS/VLC" ]; then VLC_BIN="/Applications/VLC.app/Contents/MacOS/VLC"
  else echo "VLC not found. Install it or set VLC_BIN."; exit 1; fi
fi
# --play-and-pause: freeze on the last frame at end of a clip (the "hold" behaviour)
# --qt-fullscreen-screennumber: which monitor goes fullscreen (0-based in some builds, see README)
"$VLC_BIN" --extraintf http --http-host 127.0.0.1 --http-port "$VLC_PORT" --http-password "$VLC_PASSWORD" \
  --fullscreen --no-video-title-show --no-osd --play-and-pause --no-playlist-autostart --no-qt-video-autoresize \
  --qt-fullscreen-screennumber="$SCREEN" >/dev/null 2>&1 &
VLC_PID=$!
trap 'kill $VLC_PID 2>/dev/null' EXIT
sleep 2
node server.js
