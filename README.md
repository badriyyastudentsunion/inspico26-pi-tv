# 🎨 Art Gallery 2026 - Raspberry Pi 5 TV Results & Competition Display

An ultra-responsive TV kiosk dashboard designed to run on a **Raspberry Pi 5** browser connected to a TV screen. It uses a connected USB webcam to continuously scan participant chest card QR codes, queries **Supabase**, and displays their competitions, stages, schedules, and published results (positions, grades, points) with full keyboard navigation.

---

## 📺 Features

1. **TV-Optimized Luxury UI**:
   - Matches the **Art Gallery V1** Forest / Luxury Dark aesthetic (`#0e1210`, `#151d13`, `#628141`, `#8BAE66`, `#EBD5AB` cream typography).
   - High-contrast, large-format layout designed for 1080p and 4K displays legible from across the room.
2. **Webcam QR Scanner**:
   - Continuous scanning using the connected USB webcam with glowing HUD viewfinder and animated laser targeting line.
   - Automatically handles both URL formats (`https://yourdomain/#108`) and raw chest numbers (`108`).
   - Synthesizer audio chime via Web Audio API on successful scan.
3. **Participant Profile & Results**:
   - Large digital Chest Card displaying Chest No, Name, Team, and Category.
   - Competitions list showing: Stage name, Off-stage status, Scheduled date & time.
   - Published results featuring: 🥇 1st Place, 🥈 2nd Place, 🥉 3rd Place, Grade (A/B/C), Avg marks, Placement points, and Grade points.
4. **Complete Keyboard Controls (TV Remote Friendly)**:
   - `↑` / `↓` Arrow Keys: Smoothly scroll through competition cards with active focus outline.
   - `←` / `→` Arrow Keys: Navigate through recently scanned participants.
   - Numeric Keys `0-9`: Instant chest number search (auto-focuses search bar).
   - `Space`: Pause / resume webcam scanning.
   - `Esc` or `Backspace`: Return to the welcome standby scanner screen.
   - `F` / `F11`: Toggle Fullscreen mode for TV.
   - `R`: Refresh data from Supabase.
   - `M`: Toggle audio chimes.
   - `?` or `H`: View on-screen keyboard shortcuts guide.
5. **Auto-Standby Timer**:
   - Automatically transitions back to the Standby / Scanner screen after 45 seconds of inactivity (with visual progress bar and Pause option).

---

## 🚀 How to Run on Raspberry Pi 5

### 1. Install Node.js (if not already installed)
```bash
sudo apt update
sudo apt install -y nodejs npm
```

### 2. Start the Application
In the project directory:
```bash
npm start
# or: node server.js
```

### 3. Open in Chromium Kiosk Mode
Run the provided startup script:
```bash
chmod +x start-pi.sh
./start-pi.sh
```

Or run manually:
```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --use-fake-ui-for-media-stream \
  http://localhost:3000
```

> **Note on Camera Permission**: The `--use-fake-ui-for-media-stream` flag allows Chromium to grant camera permissions to `localhost` automatically without showing popup prompts on the TV.

---

## 💻 Testing on Windows

Double-click `start-windows.bat` or run:
```powershell
npm start
```
Then open `http://localhost:3000` in Google Chrome or Edge. Press `F` for Fullscreen TV view.

---

## ⚙️ Configuration
The Supabase URL and anon key are configured in `app.js` using the Art Gallery V1 database. Local copies of `supabase.js` and `html5-qrcode.min.js` are included in `vendor/` for reliable offline/low-latency startup.
