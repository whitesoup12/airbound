# Airbound MSFS SimConnect Bridge

The **Airbound Connector** is a lightweight desktop script that bridges **Microsoft Flight Simulator 2024 / 2020** with your Airbound cloud deployment on Vercel (or local development server).

---

## 🚀 Quick Start

### 1. Configure the Connector
Edit `connector/.env`:
```ini
# When deployed to Vercel, set to your Vercel URL:
AIRBOUND_API_URL=https://your-airbound-app.vercel.app

# Pilot callsign (defaults to James)
PILOT_CALLSIGN=James
```

### 2. Launch the Connector
Double-click `start-connector.bat` (or in terminal: `npm run connector`).

### 3. Fly!
1. Open your Airbound web app in any browser (or cockpit tablet).
2. Accept a cargo or passenger contract (or commence Free Flight).
3. Jump into MSFS 2024 / 2020 at the origin airport.
4. Take off! The Flight Deck radar, airspeed, altitude, and flight phase (`IDLE` ➔ `DEPARTED` ➔ `EN ROUTE`) will track in real time.
5. Touch down at the destination airfield, decelerate below 5 knots, and engage your parking brake (or cut engines).
6. The connector captures your touchdown FPM (e.g. *-125 FPM Butter/Greaser*), settles your payout with Vercel, awards career XP, and logs the flight!

---

## 🛠️ Testing Without Flight Simulator (Mock Mode)

To verify the cloud bridge without opening Microsoft Flight Simulator:
```cmd
npm run connector:mock
```
Or set `USE_MOCK=true` in `connector/.env`. This generates realistic flight telemetry along your route to verify the entire pipeline end-to-end.
