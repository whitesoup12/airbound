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

## Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **MSFS 2024**: (Optional for testing; built-in mock telemetry works out of the box)
- **MongoDB**: Optional; if `MONGODB_URI` is not set in `server/.env`, an in-memory MongoDB instance starts automatically.

### 2. Install Dependencies
In the project root:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Seed Airport Database
Airbound includes a curated set of popular international and regional airports with exact runway lengths and coordinates:
```bash
# Fast seed (Curated global airports)
cd server
npm run seed

# Optional: Full OurAirports live download & ingestion
npm run seed:full
```

### 4. Run the Application
In separate terminal windows:

**Start the Server & SimConnect Bridge:**
```bash
cd server
npm run dev
```
*Server runs on `http://localhost:3001` with Socket.IO telemetry streaming.*

**Start the React Avionics Dashboard:**
```bash
cd client
npm run dev
```
*Open `http://localhost:5173` in your browser.*

---

## Configuration (`server/.env`)

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/airbound
# Leave USE_MOCK_SIMCONNECT=false to automatically connect to MSFS 2024
USE_MOCK_SIMCONNECT=false
CLIENT_URL=http://localhost:5173
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

