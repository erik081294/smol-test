#!/usr/bin/env bash
# Start de app op het via-USB gekoppelde Android-toestel in één commando.
#
# Bundelt de hele herstel-keten die anders met de hand moet (zie memory
# expo-go-device-blocked): adb-daemon kan stilletjes sterven na Mac-slaap of een
# Defender-scan, waardoor `adb devices` leeg is, de reverse-tunnel weg is en de
# app eindeloos blijft hangen op "Connecting to the dev server". Dit script:
#   1. zet node + adb op PATH (beide staan off-PATH; zie memory node-on-path)
#   2. zorgt dat het toestel zichtbaar is (herstart adb-server indien nodig)
#   3. kilt eventuele oude/dubbele Metro's op 8081/8082 (poort-val)
#   4. zet `adb reverse tcp:8081 tcp:8081`
#   5. cold-load de app zodra Metro klaar is (force-stop + deeplink, op achtergrond)
#   6. start ÉÉN Metro in de voorgrond met --dev-client --localhost (beide nodig!)
#      zodat je logs + Fast Refresh houdt. --localhost is cruciaal: zonder bouwt
#      Expo de URL met het LAN-IP, dat de MDM-firewall blokkeert.
#
# Draaien:
#   bash scripts/dev-device.sh      (of: npm run device)
#
# Stop met Ctrl-C; de reverse-tunnel blijft staan tot het toestel ontkoppelt.

set -euo pipefail

PORT=8081
SCHEME=huishoek
PKG=app.huishoek
DEEPLINK="${SCHEME}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${PORT}"

# --- PATH: node (nvm) + adb (Google platform-tools, overleeft Defender) ---
NODE_BIN="$HOME/.nvm/versions/node/v22.14.0/bin"
[ -d "$NODE_BIN" ] || NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1 || true)"
ADB_DIR="$HOME/android-platform-tools/platform-tools"
export PATH="$NODE_BIN:$ADB_DIR:$PATH"

command -v adb  >/dev/null || { echo "✗ adb niet gevonden (verwacht in $ADB_DIR)"; exit 1; }
command -v npx  >/dev/null || { echo "✗ npx/node niet gevonden (verwacht in $NODE_BIN)"; exit 1; }

# --- 1. Toestel zichtbaar? Zo niet, adb-daemon een schop geven ---
device_online() { adb get-state 2>/dev/null | grep -q '^device$'; }

if ! device_online; then
  echo "› toestel niet zichtbaar — adb-server herstarten…"
  adb kill-server  >/dev/null 2>&1 || true
  adb start-server >/dev/null 2>&1 || true
  sleep 1
fi
if ! device_online; then
  echo "✗ geen toestel via adb. Check: USB-kabel erin, USB-debugging aan,"
  echo "  en USB-modus op 'Bestandsoverdracht' (niet 'alleen opladen')."
  exit 1
fi
echo "✓ toestel: $(adb devices | awk '/device$/{print $1}')"

# --- 2. Oude/dubbele Metro's opruimen (poort-val) ---
for p in $(lsof -nP -iTCP:8081 -iTCP:8082 -sTCP:LISTEN -t 2>/dev/null || true); do
  kill "$p" 2>/dev/null && echo "› oude Metro gekild (pid $p)" || true
done
sleep 1

# --- 3. Reverse-tunnel zetten ---
adb reverse "tcp:${PORT}" "tcp:${PORT}" >/dev/null
echo "✓ reverse: $(adb reverse --list)"

# --- 4. Cold-load zodra Metro luistert (op achtergrond) ---
(
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null -H "expo-platform: android" "http://localhost:${PORT}/"; then
      adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
      sleep 1
      adb shell am start -a android.intent.action.VIEW -d "$DEEPLINK" >/dev/null 2>&1 \
        && echo "✓ app cold-geladen op toestel" || echo "✗ deeplink mislukt"
      exit 0
    fi
    sleep 1
  done
  echo "✗ Metro kwam niet binnen 60s op poort ${PORT}"
) &

# --- 5. Eén schone Metro in de voorgrond (Fast Refresh aan; géén CI=1) ---
echo "› Metro starten (Ctrl-C om te stoppen)…"
exec npx expo start --dev-client --localhost --port "${PORT}"
