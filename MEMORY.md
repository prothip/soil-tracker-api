# Project Memory — Soil Tracker Pro

## Project Structure
- Workspace: `/home/teep/.openclaw/workspace/`
- **Frontend (PWA)**: `/home/teep/.openclaw/workspace/frontend/`
  - React + Vite + Capacitor
  - Offline-first with IndexedDB (local-db.js)
  - PWA enabled (`vite-plugin-pwa`)
  - Live dev: `http://localhost:5174`
  - APK build: `cd android && JAVA_HOME=~/jdk-21.0.2+13 ./gradlew assembleDebug`
- **Backend (Railway)**: `/home/teep/.openclaw/workspace/backend/` (local dev)
  - URL: `https://soil-tracker-api-production.up.railway.app` (production)
  - Runs on port 3002 locally
- **Admin Panel**: `/home/teep/.openclaw/workspace/admin/index.html`
  - Served on port 5175
- **Offline APK**: `/home/teep/.openclaw/workspace/soil-tracker-pro-offline.apk` (~28MB)

## Multi-Tenant Architecture (Implemented March 30, 2026)

### How It Works
- Each **activation code** maps to a **customer** (one customer per code)
- All data tables (sites, trucks, materials, deliveries) have `customer_id`
- Device tokens stored in `licenses` table with `customer_id`
- Auth middleware extracts `customer_id` from token and filters all queries

### New Database Schema
- `customers` — id, name, activation_code, status, created_at
- `users` — admin users (global, not customer-specific)
- `sites/trucks/materials/deliveries` — all have `customer_id` column
- `codes` — activation codes linked to customer_id
- `licenses` — device tokens linked to customer_id

### Backend Routes Updated
- `/api/sites`, `/api/trucks`, `/api/materials`, `/api/deliveries` — filtered by customer_id
- `/api/stats/*` — filtered by customer_id
- `/api/offline/activate` — creates customer if not exists, returns device token with customer_id
- `/api/offline/codes` — lists/creates codes with customer_id
- `/api/admin/customers` — admin-only: list/create/delete customers + view their data

### Customer App (port 5174)
- Works as before, no changes needed
- Uses device token to authenticate, backend handles tenant isolation

### Admin Panel (port 5175)
- Shows all customers, their data, stats
- Generate/view license codes
- Download backup

### Notes
- Legacy device token `aabbccddeeff00112233445566778899` manually added to licenses table for customer 1
- Default customer: "Default Customer" with code "STP-DEMO01"
- Seed data added for customer 1: 1 site (North Field), 1 truck (TRK-001), 1 material (Topsoil), 3 deliveries (23.2 tons)

## Key Features
- **Auth Flow** (Local SQLite on device / IndexedDB on web)
  - Activation code → verify with Railway → store device ID
  - First-time login → SetUpAccount screen → create local user (SQLite/IndexedDB)
  - Subsequent logins → verify against local DB
  - Default credentials: `Admin / admin123`
  - Logout: clears session + calls `closeDB()` + reload
- **Core Features**
  - Delivery logging (site, truck, lot, material, weight, notes)
  - Real-time dashboard (today/total deliveries, tons, active trucks)
  - Delivery log with search/filter + edit/delete
  - Truck registry (active/archived) + QR scanner
  - Sites & materials CRUD
  - Reports & Export (date range, site, material)
  - Backup/Restore (JSON export/import via local IndexedDB)
  - Change password / username

## Known Working
- Authentication: ✅ (login/logout cycles work)
- Delivery logging: ✅ (form submits, local DB storage)
- Reports: ✅ (loadReport() uses local getRangeStats/getDeliveries)
- Truck QR: ✅ (scanner finds truck by plate number)
- Backup: ✅ (exportDatabase() saves to Directory.Data)
- Restore: ✅ (importDatabase() from selected .json)
- View button: ✅ (shows report data in modal)
- Date pickers: ✅ (fixed)
- Multi-tenant: ✅ (customer_id isolation working)
- Print/PDF export: ✅ (jspdf-autotable)

## Known Issues (Fixed)
- **Print button**: Was stubbed in `local-db.js` → replaced with `window.print()`
- **Activation codes**: Had to use clean codes (no dashes) → `STP-75575658` works
- **Git reverts**: Fixed by re-applying offline changes after each `git checkout`
- **Logout**: Added `closeDB()` call to prevent DB locks
- **jspdf v5 API**: `autoTable(doc, {...})` not `doc.autoTable({...})`

## Activation Codes (Railway server)
- Server: `https://soil-tracker-api-production.up.railway.app`
- Generator: `https://soil-tracker-api-production.up.railway.app/license-generator`
- Active: `STP-75575658`, `STP-CC8361A1`

## Build Commands
- Frontend dev: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
- APK: `cd android && JAVA_HOME=~/jdk-21.0.2+13 ./gradlew assembleDebug`
  - Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Offline APK (manual): Pre-built at `soil-tracker-pro-offline.apk`
- Backend (local): `cd backend && node src/index.js`

## Notes
- Teep works from WSL2 on Windows
- Android SDK: `~/android-sdk/`
- JDK 21: `~/jdk-21.0.2+13/`
- Repeated issue: `git checkout` would overwrite `App.jsx` with old online-only code — had to re-apply fixes
- Last known good state: March 30, 2026 — multi-tenant working, API solid
