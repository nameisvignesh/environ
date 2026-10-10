#!/bin/sh
set -eu

Xvfb :0 -screen 0 1440x900x24 -nolisten tcp &
fluxbox >/tmp/environ-window-manager.log 2>&1 &
x11vnc -display :0 -forever -shared -nopw -localhost -rfbport 5900 >/tmp/environ-vnc.log 2>&1 &
websockify --web=/usr/share/novnc/ 0.0.0.0:6080 127.0.0.1:5900 >/tmp/environ-websockify.log 2>&1 &

sleep 1
exec npm start -- --no-sandbox --disable-gpu
