# Soil Tracker Pro — SPEC.md

## 1. Concept & Vision

A professional-grade delivery management tool for construction site managers. Tracks soil carrier deliveries across multiple sites, with full truck management, material types, weight logging, and reporting. Built for real site conditions — works offline, fast to use with dirty hands, clear in sunlight. This isn't a MVP — it's a tool someone would pay for.

---

## 2. Design Language

**Aesthetic:** Clean industrial SaaS — slate/gray foundations, earthy amber accents, high contrast for outdoor visibility. Think "construction tech" not "construction chaos."

**Colors:**
- Primary: `#2563EB` (blue — actions, links)
- Accent: `#D97706` (amber — earth, highlights)
- Background: `#F1F5F9` (slate-100)
- Surface: `#FFFFFF`
- Text: `#0F172A` (slate-900)
- Muted: `#64748B` (slate-500)
- Border: `#CBD5E1` (slate-300)
- Success: `#16A34A` (green)
- Warning: `#D97706` (amber)
- Danger: `#DC2626` (red)

**Typography:**
- Font: `Inter` (Google Fonts)
- Headings: Bold, tight tracking
- Body: Regular, relaxed line-height
- Tabular nums for all numbers

**Spatial System:**
- 4px base unit
- Touch targets: min 44px
- Card padding: 20px
- Section spacing: 24–32px

**Motion:**
- Page transitions: fade 150ms
- Button press: scale(0.98)
- Toast notifications: slide in from bottom

---

## 3. Layout & Structure

**App Shell:**
```
┌──────────────────────────────────┐
│  TOPBAR (sticky)                 │
│  Logo + Site Selector + User    │
├──────────────────────────────────┤
│  CONTENT (scrollable)           │
│  Page-specific content          │
├──────────────────────────────────┤
│  BOTTOM NAV (fixed)             │
│  Dashboard | Log | Trucks | More│
└──────────────────────────────────┘
```

**Navigation (bottom bar):**
- **Dashboard** — Stats overview + charts
- **Log** — Daily delivery log + quick entry
- **Trucks** — Truck registry
- **More** — Settings, Export, Site Mgmt, User

**Desktop:** Max-width 640px centered, stays mobile-first layout.

---

## 4. Features

### 4.1 Authentication
- Login with username + password (JWT, bcrypt hashed)
- Persistent session (localStorage token)
- Default admin: `admin` / `admin123` (prompt to change)
- Protected routes — redirect to login if not authed

### 4.2 Site Management
- Multiple sites (e.g., "Site A — Rama III", "Site B — Suvarnabhumi")
- Each site has its own: name, location, delivery log
- Site selector in topbar (dropdown)
- Sites stored in DB, selectable by admin

### 4.3 Truck Registry
- Add/edit/archive trucks
- Fields: Plate Number, Driver Name, Capacity (tons), Status (active/inactive)
- Trucks shared across sites
- Auto-suggest truck when logging (type to search)

### 4.4 Material Types
- Predefined list: Laterite, Sand, Gravel, Clay, Topsoil, Mixed
- Each lot linked to a material type
- Material filter in log and stats

### 4.5 Delivery Logging (Log tab)
- Fields:
  - **Truck** (dropdown from registry, searchable)
  - **Lot Number** (text, auto-uppercase)
  - **Material** (dropdown)
  - **Weight (tons)** (number input)
  - **Notes** (optional text)
  - **Date** (defaults today, can backfill)
  - **Time** (auto-captured, editable)
- Duplicate lot number warning (same truck + date = possible duplicate)
- Submit → toast "Delivery logged" → form clears

### 4.6 Daily Log Table
- Columns: Time | Truck | Driver | Lot | Material | Weight | Actions
- Sort by time (newest first default)
- Filter by material type
- Search by lot number or truck
- Pagination (20 per page)
- Empty state: "No deliveries on [date]"

### 4.7 Dashboard
- **Summary cards:** Today's lots, Today's trucks, Today's tonnage, Week tonnage
- **Weekly tonnage chart** — bar chart (last 7 days)
- **Top trucks this week** — ranked list
- **Recent deliveries** — last 5 entries

### 4.8 Stats / Reports (More tab)
- Date range picker
- Filter by site, truck, material
- Table: Date | Truck | Driver | Lot | Material | Weight
- **Export CSV** — downloads filtered data as CSV
- Grand totals row

### 4.9 Offline Support (PWA)
- Service worker caches app shell
- Deliveries queued in localStorage when offline
- Sync indicator in topbar when offline
- Auto-sync when back online

### 4.10 Settings (More tab)
- Change password
- Site management (add/edit/archive sites)
- Truck management (add/edit/archive trucks)
- Material type management
- Clear local data

---

## 5. Component Inventory

### Topbar
- Logo left, site selector center (dropdown), user avatar/menu right
- Offline indicator (amber dot + "Offline" text)
- White background, bottom border, sticky

### Summary Card
- Large number, label below, optional icon
- White bg, shadow-sm, rounded-xl, border

### Log Form Card
- White bg, shadow-sm, rounded-xl, border
- Truck dropdown with search
- All inputs stacked or 2-col grid
- Submit button full-width, primary blue

### Log Table
- Sticky header row
- Alternating row backgrounds or clean white
- Row hover highlight
- Action buttons: Edit (pencil icon), Delete (trash icon)
- Pagination controls at bottom

### Truck Card
- Plate number (bold), driver name, capacity badge
- Status indicator (green=active, gray=inactive)
- Edit/Delete actions

### Bottom Nav
- 4 tabs, icon + label, fixed bottom
- Active: primary color, inactive: muted

### Toast Notification
- Bottom center, slide up
- Success (green), Error (red), Info (blue)
- Auto-dismiss 3s

### Modal
- Overlay (dark), centered card
- Used for: confirm delete, edit delivery, edit truck

### Date Range Picker
- Two date inputs (From / To)
- Quick presets: Today, This Week, This Month, Custom

---

## 6. Technical Approach

### Stack
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express + better-sqlite3
- **Auth:** JWT (access token in memory, refresh in httpOnly concept — simplified for local)
- **Charts:** Recharts (lightweight, React-native)
- **PWA:** vite-plugin-pwa (Workbox)
- **Icons:** Lucide React

### Database Schema

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sites
CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trucks
CREATE TABLE trucks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate_number TEXT UNIQUE NOT NULL,
  driver_name TEXT,
  capacity_tons REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Materials
CREATE TABLE materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

-- Deliveries
CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  truck_id INTEGER REFERENCES trucks(id),
  lot_number TEXT NOT NULL,
  material_id INTEGER REFERENCES materials(id),
  weight_tons REAL DEFAULT 0,
  notes TEXT,
  delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  date TEXT NOT NULL  -- YYYY-MM-DD
);

-- Indexes
CREATE INDEX idx_deliveries_site ON deliveries(site_id);
CREATE INDEX idx_deliveries_date ON deliveries(date);
CREATE INDEX idx_deliveries_truck ON deliveries(truck_id);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/sites` | List sites |
| POST | `/api/sites` | Create site |
| GET | `/api/trucks` | List trucks |
| POST | `/api/trucks` | Create truck |
| PUT | `/api/trucks/:id` | Update truck |
| DELETE | `/api/trucks/:id` | Archive truck |
| GET | `/api/materials` | List materials |
| POST | `/api/deliveries` | Create delivery |
| GET | `/api/deliveries` | List deliveries (filter: site_id, date, truck_id, material_id, search, page) |
| PUT | `/api/deliveries/:id` | Update delivery |
| DELETE | `/api/deliveries/:id` | Delete delivery |
| GET | `/api/stats/daily?site_id=&date=` | Daily stats |
| GET | `/api/stats/range?site_id=&start=&end=&material_id=` | Range stats for chart |
| GET | `/api/export?site_id=&start=&end=&material_id=` | CSV export |

### Project Structure
```
soil-tracker-pro/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── App.jsx
│   ├── public/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── db/
│   │   └── index.js
│   ├── data/
│   └── package.json
├── SPEC.md
└── README.md
```

### Seed Data
- Admin user: admin / admin123
- Default materials: Laterite, Sand, Gravel, Clay, Topsoil, Mixed
- Demo site: "Site A — Rama III"
- Demo trucks: T-001 (Driver: Somchai), T-002 (Driver: Prasert), T-003 (Driver: Anan)
