#!/bin/bash
set -e
export PATH="$PATH:/usr/local/bin:/usr/bin"
cd backend
npm install --omit=dev
exec node src/index.js
