#!/bin/bash
cd /home/teep/.openclaw/workspace/soil-tracker-pro
# Kill any existing on 3002
fuser -k 3002/tcp 2>/dev/null
sleep 1
node backend/src/index.js > /tmp/stp-pro.log 2>&1 &
echo "Soil tracker pro started"
