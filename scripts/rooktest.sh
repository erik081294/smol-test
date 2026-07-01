#!/usr/bin/env bash
# Geautomatiseerde device-rooktest (INF-3) op het via-USB-gekoppelde Android-toestel, met
# één kort pass/fail-oordeel. Vervangt het handmatige "door de UI tikken + screenshots lezen".
# Twee delen:
#   1. Crash-sweep via deeplinks — navigeert razendsnel langs élk hoofdscherm (huishoek://<route>)
#      en checkt via een uiautomator-dump dat de error-boundary (t-error-boundary) niet verschijnt.
#   2. Maestro behavior-flows (.maestro/*.yaml) — de kritieke interacties; Maestro maakt alléén
#      bij een fout een screenshot/video.
# Daarnaast wordt adb logcat meegestreamd en op harde JS/native-fouten gegrep't.
#
# Precondities (niet geautomatiseerd — bewust simpel houden):
#   1. `npm run device` draait in een andere terminal (Metro + reverse-tunnel + de app
#      cold-geladen op het toestel).
#   2. De app staat op een INGELOGD test-huishouden (erik@evdn.nl) met de modules aan;
#      de flows starten op de tabbalk, niet op de auth-/onboarding-flow.
#
# Draaien:
#   npm run rooktest                      # crash-sweep + alle flows in .maestro/
#   npm run rooktest -- .maestro/01-taak.yaml   # één flow (geen sweep)
#
# Exit-code 0 = sweep schoon, alle flows groen én logcat schoon. Non-zero = een route/flow
# faalde of er stond een harde JS/native-fout in logcat (geschikt voor CI later).

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

PKG=app.huishoek
PORT=8081
DEV_URL="huishoek://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${PORT}"

# Deeplink-helper: navigeer de (reeds geladen) app direct naar een route. Expliciet naar
# de dev-client-activity (-n) zodat een óók-geïnstalleerde preview-build (app.huishoek.preview)
# het huishoek://-scheme niet met een "Openen met"-keuze onderschept. Een deeplink sluit
# ook een open modal en keert terug naar de route — daarmee is 't onze snelle reset.
nav() { adb shell am start -n "$PKG/.MainActivity" -a android.intent.action.VIEW -d "huishoek://$1" >/dev/null 2>&1 || true; }

# app_loaded: is de tab-shell (t-tab-vandaag) aanwezig? = de JS-bundle is geladen én ingelogd.
app_loaded() {
  adb shell uiautomator dump /sdcard/rooktest-ui.xml >/dev/null 2>&1 || return 1
  adb shell cat /sdcard/rooktest-ui.xml 2>/dev/null | grep -q 'resource-id="t-tab-vandaag"'
}

# --- App cold-laden op de dev-client bundle ---
# Maestro's eigen launchApp opent de dev-client-LAUNCHER (niet de JS-bundle); wij laden 'm
# hier via de Metro-deeplink zodat de flows op de echte UI starten. Vereist Metro (npm run device).
# We wachten actief tot de tab-shell er staat (niet blind slapen): een koude bundle-reload
# duurt soms 20-30s, en te vroeg starten laat álle flows op het eerste element falen.
if curl -sf -o /dev/null -H "expo-platform: android" "http://localhost:${PORT}/"; then
  echo "› app cold-laden via dev-client deeplink…"
  adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
  sleep 1
  adb shell am start -n "$PKG/.MainActivity" -a android.intent.action.VIEW -d "$DEV_URL" >/dev/null 2>&1 || true
  echo -n "  wachten tot de app geladen is"
  for _ in $(seq 1 45); do
    if app_loaded; then echo " ✓"; break; fi
    echo -n "."; sleep 1
  done
  app_loaded || echo " ⚠ tab-shell niet gezien binnen 45s — ben je ingelogd op het test-huishouden?"
else
  echo "⚠ Metro luistert niet op :${PORT} — draait 'npm run device'? (ga uit van een reeds geladen app)"
fi

# --- Uitvoermap (logcat + junit-rapporten) ---
RUN_DIR="${ROOKTEST_OUT:-${TMPDIR:-/tmp}/huishoek-rooktest/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$RUN_DIR"
LOGCAT_FILE="$RUN_DIR/logcat.txt"

# --- Logcat-capture starten (buffer eerst legen) ---
adb logcat -c >/dev/null 2>&1 || true
adb logcat -v time > "$LOGCAT_FILE" 2>/dev/null &
LOGCAT_PID=$!
trap 'kill "$LOGCAT_PID" 2>/dev/null || true' EXIT   # logcat altijd stoppen, ook bij Ctrl-C

MAESTRO_RC=0
FAILED_FLOWS=""

# error_boundary_hit: dumpt de UI-hiërarchie en checkt of de error-boundary-fallback
# (resource-id t-error-boundary, uit lib/ErrorBoundary.js) zichtbaar is.
error_boundary_hit() {
  adb shell uiautomator dump /sdcard/rooktest-ui.xml >/dev/null 2>&1 || return 1
  adb shell cat /sdcard/rooktest-ui.xml 2>/dev/null | grep -q 'resource-id="t-error-boundary"'
}

# --- 1. Crash-sweep via deeplinks (razendsnel: geen /meer-round-trips) ---
# Loop elke route langs en assert dat de error-boundary NIET verschijnt. Harde crashes
# (app valt weg) komen daarnaast via de logcat-grep binnen.
run_sweep() {
  local routes="vandaag taken boodschappen kosten planten huisdieren voertuigen tijdlijn maaltijden voorraad schoonmaak inzichten delen huishouden instellingen"
  local r fails=""
  echo "› crash-sweep (deeplinks)…"
  for r in $routes; do
    nav "$r"; sleep 1.5
    if error_boundary_hit; then fails="$fails $r"; echo "  ✗ $r → error-boundary"; else echo "  ✓ $r"; fi
  done
  [ -n "$fails" ] && { MAESTRO_RC=1; FAILED_FLOWS="$FAILED_FLOWS crash-sweep:($fails )"; }
}

# --- 2. Behavior-flows (Maestro), elk voorafgegaan door een deeplink-reset ---
run_flow() {
  local f="$1" name; name="$(basename "$f" .yaml)"
  # Snelle reset: deeplink naar home (sluit een open modal), wacht kort tot de tab-shell
  # er weer staat zodat de flow niet op z'n eerste element faalt.
  nav vandaag
  for _ in $(seq 1 10); do app_loaded && break; sleep 1; done
  echo "› flow: $name"
  maestro test "$f" --format junit --output "$RUN_DIR/$name.xml"
  [ $? -ne 0 ] && { MAESTRO_RC=1; FAILED_FLOWS="$FAILED_FLOWS $name"; }
}

if [ -d "$TARGET" ]; then
  run_sweep
  for f in "$TARGET"/[0-9][0-9]-*.yaml; do
    run_flow "$f"
  done
else
  run_flow "$TARGET"   # één specifieke flow
fi

# --- Testdata opruimen (self-clean op DB-niveau) ---
# De behavior-flows maken `E2E…`-rijen; die ruimen we hier deterministisch op i.p.v. via de
# UI (de app verwijdert undo-toast-gestuurd, wat na een editor-`router.back()` niet betrouwbaar
# afvuurt). Vereist SUPABASE_SERVICE_ROLE_KEY in .env; ontbreekt die, dan slaat het script over.
if [ -f .env ]; then
  echo "› E2E-testdata opruimen…"
  node --env-file=.env scripts/rooktest-cleanup.mjs || echo "  ⚠ cleanup-script gaf een fout"
fi

# Logcat een tel laten narennen zodat een laatste fout nog binnenkomt, dan stoppen.
sleep 1
kill "$LOGCAT_PID" 2>/dev/null || true

# --- Logcat op harde fouten grep'en ---
# Harde fouten die een Maestro-assert kan missen (een fout die het scherm niet breekt,
# maar wel een crash/rejection logt). Allowlist filtert bekende dev-ruis eruit.
ERR_PATTERNS='FATAL EXCEPTION|E ReactNativeJS|Unhandled promise rejection|Render Error|AndroidRuntime.*Exception'
# uiautomator/UiAutomation: onze eigen UI-dumps botsen soms met Maestro's accessibility-connectie
# ("already registered") → dat is tooling-ruis, geen app-crash. Filter 'm eruit.
EXCLUDE_PATTERNS='Require cycle|new NativeEventEmitter|uiautomator|UiAutomation'
LOG_HITS="$(grep -E "$ERR_PATTERNS" "$LOGCAT_FILE" 2>/dev/null | grep -vE "$EXCLUDE_PATTERNS" || true)"
HIT_COUNT="$(printf '%s' "$LOG_HITS" | grep -c . || true)"

# --- Eindoordeel ---
echo
echo "──────── rooktest-oordeel ────────"
if [ "$MAESTRO_RC" -eq 0 ]; then
  echo "✓ Maestro-flows: alle groen"
else
  echo "✗ Maestro-flows: gefaald ⇒$FAILED_FLOWS (zie hierboven + screenshots in ~/.maestro/tests/)"
fi

if [ "$HIT_COUNT" -eq 0 ]; then
  echo "✓ logcat: schoon (geen harde JS/native-fouten)"
else
  echo "✗ logcat: $HIT_COUNT verdachte regel(s):"
  printf '%s\n' "$LOG_HITS" | sed 's/^/    /' | head -20
fi

echo
echo "rapporten: $RUN_DIR/*.xml"
echo "logcat:    $LOGCAT_FILE"
echo "screenshots (bij falen): ~/.maestro/tests/<laatste>/"
echo "──────────────────────────────────"

# Exit non-zero als een flow faalde óf logcat een harde fout toonde.
if [ "$MAESTRO_RC" -ne 0 ] || [ "$HIT_COUNT" -ne 0 ]; then
  exit 1
fi
exit 0
