#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:$PATH"
cd backend
npm install --omit=dev
node src/index.js
