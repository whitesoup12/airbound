# Airbound — MSFS 2024 Career & Flight Tracker

A career and live flight tracking companion app for **Microsoft Flight Simulator 2024**.

Airbound generates distance- and runway-scaled contract jobs from your current location, tracks your flight phases in real time via **SimConnect**, renders your flight route on an interactive tactical radar map, and automatically logs earnings, pilot stats, and visited airports.

![Airbound Overview](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/plane.svg)

---

## Key Features

- **Dynamic Dispatch Job Engine**:
  - Automatically queries destinations using MongoDB **`$nearSphere`** geospatial queries ($1\text{ NM} = 1852\text{ m}$).
  - Filters destinations based on minimum required runway length (`longest_runway_ft`).
  - Scaled payout formula:
    $$\text{Payout} = (\text{Distance} \times \text{Base Rate}) + \text{Complexity Multipliers (Cargo, Pax, Short Runway Challenge)}$$
- **SimConnect Telemetry Bridge**:
  - Live 1–2 Hz polling via `node-simconnect`.
  - Monitored SimVars: `PLANE LATITUDE`, `PLANE LONGITUDE`, `PLANE ALTITUDE`, `SIM ON GROUND`, `AIRSPEED TRUE`, `GROUND VELOCITY`, `BRAKE PARKING POSITION`, `ENG COMBUSTION:1`, `PLANE HEADING DEGREES TRUE`.
  - Built-in Mock Simulator Mode for full UI testing and development even when MSFS 2024 is not running.
- **Flight Phase State Machine**:
  - **`IDLE`**: Active job accepted; aircraft parked at departure airport.
  - **`DEPARTED`**: `SIM ON GROUND` transitions from `true` to `false` within 5 NM of origin.
  - **`EN ROUTE`**: Airborne tracking mode; real-time coordinates and remaining distance streamed to map.
  - **`TOUCHDOWN`**: `SIM ON GROUND` transitions from `false` to `true` within 3 NM of destination airport.
  - **`COMPLETED`**: Ground speed $< 5\text{ kts}$ AND (Parking brake engaged OR engine shutdown).
- **Automated Career Persistence**:
  - Job status updated to `completed`.
  - Pilot balance credited with job payout.
  - Pilot current ICAO set to destination airport.
  - Destination airport and country code added to `visited_airports` and `visited_countries` using `$addToSet` (preventing duplicates).
  - Detailed flight summary appended to `flight_log`.
  - Fresh jobs auto-generated for the new airfield upon arrival!
- **Avionics Cockpit UI**:
  - Dark glass theme with live digital flight gauges (Airspeed, Ground Speed, Altitude, Heading, Systems).
  - Interactive Leaflet map with rotated aircraft icon matching heading, route waypoints, and markers for all visited airports.
  - Interactive Pilot Logbook modal with career stats and flight history.
  - Built-in Simulator Controls drawer to step flight phases or auto-fly routes at 1x to 12x speed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (SPA), Vite, Tailwind CSS, Leaflet & `react-leaflet`, `lucide-react` |
| **Backend** | Node.js (Express), Socket.IO (live telemetry streaming at 1–2 Hz) |
| **SimConnect** | `node-simconnect` (direct MSFS 2024 interface) |
| **Database** | MongoDB Atlas / Mongoose ODM (with 2dsphere geospatial index) + in-memory fallback |
| **Data Source** | OurAirports (`airports.csv` & `runways.csv`) + curated global dataset |

---

## Quick Start (Desktop Standalone)

Airbound runs **100% locally on your PC** with zero external database configuration, no API keys, and automatic SimConnect integration.

### Method 1: Download Windows Executable (.exe) — *For Flight Simmers*
1. Download **`Airbound Setup 1.0.0.exe`** (Installer) or **`Airbound 1.0.0.exe`** (Portable standalone) from [Releases](https://github.com/your-username/airbound/releases).
2. Run the executable.
3. Airbound starts immediately with an embedded database, hooks into MSFS 2024, and launches the cockpit dashboard in a dedicated window.  
*(No Node.js, terminal, or database installation required!)*

### Method 2: One-Click Windows Batch Launcher
1. Install [Node.js](https://nodejs.org) (v18 or higher, LTS recommended).
2. Double-click **`Airbound.bat`** in the repository folder.
3. Airbound automatically:
   - Sets up dependencies and builds the avionics client.
   - Starts the built-in persistent local database (`./data/db`).
   - Hooks directly into MSFS 2024 via SimConnect.
   - Opens `http://localhost:3001` in your default browser!

### Method 3: Build & Package from Source
```bash
# Clone the repository
git clone https://github.com/your-username/airbound.git
cd airbound

# Install dependencies
npm install

# Option A: Run in development / local browser mode
npm start

# Option B: Run in native Electron desktop window
npm run electron

# Option C: Build standalone Windows .exe installer and portable binary
npm run dist:exe
# Output generated in ./release (Airbound Setup 1.0.0.exe & Airbound 1.0.0.exe)
```

---

## Developer & Cloud Setup (Optional)

If you wish to modify the frontend in real time with Vite HMR, or deploy Airbound to Vercel with MongoDB Atlas:

```bash
# Terminal 1: Run Backend in watch mode
npm run dev:server

# Terminal 2: Run Frontend with Vite hot reload
npm run dev:client
```

### Configuration (`.env`) — *100% Optional*
Airbound requires **no `.env` file** to run locally. If you wish to customize your port, data directory, or point to a remote MongoDB Atlas cluster:

```env
# Optional: Port (Default: 3001)
PORT=3001

# Optional: Remote MongoDB Atlas URI (Leave empty to use embedded local DB in ./data/db)
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/airbound

# Optional: SimConnect Mock Mode (Set to true to test flight mechanics without MSFS running)
USE_MOCK_SIMCONNECT=false
```

---

## Running Automated Tests

Airbound includes both unit/integration tests and complete end-to-end flight lifecycle tests:

```bash
cd server

# Run unit tests (Geo calculations, $nearSphere query, state machine transitions)
npm test

# Run End-to-End integration test (HTTP API + Socket.IO + full flight completion)
npm run test:e2e
```

---

## Flight Phase State Machine Reference

```
[ Job Accepted ]
       │
       ▼
   ┌───────┐
   │ IDLE  │  ◄── Parked at departure ICAO, engine idle / parking brake set
   └───┬───┘
       │  SIM ON GROUND: true -> false (within 5 NM of origin)
       ▼
 ┌───────────┐
 │ DEPARTED  │ ◄── Climbing out of origin airfield
 └─────┬─────┘
       │  Climb past 1000 ft / > 2 NM
       ▼
 ┌───────────┐
 │ EN ROUTE  │ ◄── Airborne cruise; coordinates & heading streaming
 └─────┬─────┘
       │  SIM ON GROUND: false -> true (within 3 NM of destination)
       ▼
 ┌───────────┐
 │ TOUCHDOWN │ ◄── Touchdown and rollout on destination runway
 └─────┬─────┘
       │  Ground speed < 5 kts AND (Parking brake engaged OR Engine shutdown)
       ▼
 ┌───────────┐
 │ COMPLETED │ ◄── Payout credited, destination saved, logbook updated
 └───────────┘
```

---

## License
MIT License

