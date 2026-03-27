#!/bin/bash -l
cd backend
npm install --omit=dev
exec node src/index.js
