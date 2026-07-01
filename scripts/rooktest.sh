#!/usr/bin/env bash
# Geautomatiseerde device-rooktest (INF-3): draai de Maestro-flows op het
# via-USB-gekoppelde Android-toestel én vang errors af, met één kort pass/fail-oordeel.
# Vervangt het handmatige "door de UI tikken + screenshots lezen": Maestro navigeert
# zelf, assert't op zichtbare tekst/id's, en maakt alléén bij een fout een screenshot.
#
# Precondities (niet geautomatiseerd — bewust simpel houden):
#   1. `npm run device` draait in een andere terminal (Metro + reverse-tunnel + de app
#      cold-geladen op het toestel).
#   2. De app staat op een INGELOGD test-huishouden (erik@evdn.nl) met de modules aan;
#      de flows starten op de tabbalk, niet op de auth-/onboarding-flow.
#
# Draaien:
#   npm run rooktest                      # alle flows in .maestro/
#   npm run rooktest -- .maestro/01-taak.yaml   # één flow
#
# Exit-code 0 = alle flows groen én logcat schoon. Non-zero = een flow faalde of er
# stond een harde JS/native-fout in logcat (geschikt voor CI later).

set -uo pipefail   # géén -e: we willen ná een falende flow nog het logcat-oordeel geven

TARGET="${1:-.maestro/}"

# --- PATH: node (nvm) + adb (platform-tools) + maestro ---
NODE_BIN="$HOME/.nvm/versions/node/v22.14.0/bin"
[ -d "$NODE_BIN" ] || NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1 || true)"
ADB_DIR="$HOME/android-platform-tools/platform-tools"
MAESTRO_BIN="$HOME/.maestro/bin"
export PATH="$NODE_BIN:$ADB_DIR:$MAESTRO_BIN:$PATH"

# Maestro draait op de JVM; Java staat hier niet op PATH. Val terug op de JDK 17 die
# Android Studio meelevert (zelfde bron als de lokale dev-build) als JAVA_HOME leeg is.
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "${JAVA_HOME:-}/bin/java" ]; then
  ASTUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  [ -x "$ASTUDIO_JBR/bin/java" ] && export JAVA_HOME="$ASTUDIO_JBR"
fi
[ -n "${JAVA_HOME:-}" ] && export PATH="$JAVA_HOME/bin:$PATH"

command -v adb     >/dev/null || { echo "✗ adb niet gevonden (verwacht in $ADB_DIR)"; exit 1; }
command -v maestro >/dev/null || { echo "✗ maestro niet gevonden — installeer: curl -fsSL https://get.maestro.mobile.dev | bash"; exit 1; }
command -v java    >/dev/null || { echo "✗ java niet gevonden — Maestro heeft een JDK nodig (bv. Android Studio's JBR)"; exit 1; }

# --- Toestel zichtbaar? (zelfde herstel-schop als dev-device.sh) ---
device_online() { adb get-state 2>/dev/null | grep -q '^device$'; }
if ! device_online; then
  echo "› toestel niet zichtbaar — adb-server herstarten…"
  adb kill-server >/dev/null 2>&1 || true
  adb start-server >/dev/null 2>&1 || true
  sleep 1
fi
device_online || { echo "✗ geen toestel via adb. Check USB + USB-debugging, en dat 'npm run device' draait."; exit 1; }
echo "✓ toestel: $(adb devices | awk '/device$/{print $1}')"

# --- App cold-laden op de dev-client bundle ---
# Maestro's eigen `launchApp` opent de dev-client-LAUNCHER (niet de JS-bundle); de flows
# gaan daarom uit van een reeds geladen app. Wij laden 'm hier via dezelfde deeplink als
# dev-device.sh, zodat de flows op de echte UI starten. Vereist een draaiende Metro
# (`npm run device`). De eerste `tapOn`/`assertVisible` in een flow wacht de bundle-load af.
PKG=app.huishoek
PORT=8081
DEEPLINK="huishoek://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${PORT}"
if curl -sf -o /dev/null -H "expo-platform: android" "http://localhost:${PORT}/"; then
  echo "› app cold-laden via dev-client deeplink…"
  adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
  sleep 1
  adb shell am start -a android.intent.action.VIEW -d "$DEEPLINK" >/dev/null 2>&1 || true
  sleep 3
else
  echo "⚠ Metro luistert niet op :${PORT} — draait 'npm run device'? (ga uit van een reeds geladen app)"
fi

# --- Uitvoermap (logcat + junit-rapport) ---
RUN_DIR="${ROOKTEST_OUT:-${TMPDIR:-/tmp}/huishoek-rooktest/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$RUN_DIR"
LOGCAT_FILE="$RUN_DIR/logcat.txt"
REPORT="$RUN_DIR/report.xml"

# --- Logcat-capture starten (buffer eerst legen) ---
adb logcat -c >/dev/null 2>&1 || true
adb logcat -v time > "$LOGCAT_FILE" 2>/dev/null &
LOGCAT_PID=$!
# Zorg dat logcat altijd wordt gestopt, ook bij Ctrl-C.
trap 'kill "$LOGCAT_PID" 2>/dev/null || true' EXIT

echo "› Maestro-flows draaien ($TARGET)…"
maestro test "$TARGET" --format junit --output "$REPORT"
MAESTRO_RC=$?

# Logcat een tel laten narennen zodat een laatste fout nog binnenkomt, dan stoppen.
sleep 1
kill "$LOGCAT_PID" 2>/dev/null || true

# --- Logcat op harde fouten grep'en ---
# Harde fouten die een Maestro-assert kan missen (een fout die het scherm niet breekt,
# maar wel een crash/rejection logt). Allowlist filtert bekende dev-ruis eruit.
ERR_PATTERNS='FATAL EXCEPTION|E ReactNativeJS|Unhandled promise rejection|Render Error|AndroidRuntime.*Exception'
EXCLUDE_PATTERNS='Require cycle|new NativeEventEmitter'
LOG_HITS="$(grep -E "$ERR_PATTERNS" "$LOGCAT_FILE" 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS" || true)"
HIT_COUNT="$(printf '%s' "$LOG_HITS" | grep -c . || true)"

# --- Eindoordeel ---
echo
echo "──────── rooktest-oordeel ────────"
if [ "$MAESTRO_RC" -eq 0 ]; then
  echo "✓ Maestro-flows: alle groen"
else
  echo "✗ Maestro-flows: minstens één faalde (zie hierboven + screenshots in ~/.maestro/tests/)"
fi

if [ "$HIT_COUNT" -eq 0 ]; then
  echo "✓ logcat: schoon (geen harde JS/native-fouten)"
else
  echo "✗ logcat: $HIT_COUNT verdachte regel(s):"
  printf '%s\n' "$LOG_HITS" | sed 's/^/    /' | head -20
fi

echo
echo "rapport:  $REPORT"
echo "logcat:   $LOGCAT_FILE"
echo "screenshots (bij falen): ~/.maestro/tests/<laatste>/"
echo "──────────────────────────────────"

# Exit non-zero als een flow faalde óf logcat een harde fout toonde.
if [ "$MAESTRO_RC" -ne 0 ] || [ "$HIT_COUNT" -ne 0 ]; then
  exit 1
fi
exit 0
