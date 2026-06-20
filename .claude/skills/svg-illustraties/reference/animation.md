# Animeren van illustraties

## Twee harde randvoorwaarden

1. **react-native-svg ondersteunt geen SMIL/`<animate>`.** Animeren in de app
   gebeurt door een *wrapper* of losse primitieven te animeren met een
   JS-animatie-API — niet door animatie-attributen in de SVG.
2. **Respecteer "verminder beweging".** Gebruik `prefersReducedMotion()` uit
   [lib/motion.js](../../../../lib/motion.js); bij `true` render je direct de
   eindstand, zonder animatie (DESIGN.md "verminder beweging").

## Welke API
Dit project gebruikt voor micro-polish **bewust de ingebouwde `Animated`-API**
(zie [lib/ui.js](../../../../lib/ui.js) en de comment in `lib/motion.js`:
"i.p.v. een zware lib"). `react-native-reanimated` zit wél in de deps voor
zwaardere gevallen, maar houd je voor illustratie-polish aan `Animated` zodat het
bij de rest van de codebase past. Conventies om over te nemen:
`NATIVE_DRIVER = Platform.OS !== 'web'`, spring `{ friction: 4, tension: 160 }`,
duraties uit `motion` (`fast 150 / base 220 / slow 360`).

## Recept A — entree (opveren + infaden) — AL TOEGEPAST
De default zit **ingebouwd in de `Illustration`-API** (`lib/illustrations.js`):
élke lege staat veert bij verschijnen zacht in beeld (opacity + scale 0.92→1 +
een lift van 8px), één keer, via `Animated.spring`. Je hoeft hier dus niets voor
te doen; dit is hoe het erin zit:

```jsx
const reduced = prefersReducedMotion();
const p = useRef(new Animated.Value(reduced ? 1 : 0)).current; // 0→1 voortgang
useEffect(() => {
  if (reduced) return;
  Animated.spring(p, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 6, tension: 90 }).start();
}, [p, reduced, name]);

const scale = p.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
// op de Animated.View-wrapper: opacity: p, transform: [{ translateY }, { scale }]
```

`friction 6 / tension 90` is een zachtere settle dan de knop-spring
(`friction 4 / tension 160`) — passend voor een rustige lege staat. Beoordeel met
`filmstrip.mjs <naam> --type entrance` (zie onder).

## Recept B — idle-loop: ⚠️ NIET via een geanimeerde SVG-`transform`
De voor de hand liggende idle (alleen het loof laten wiegen door
`Animated.createAnimatedComponent(G)` + een geïnterpoleerde rotate-string op de
`transform`-prop) **crasht op de nieuwe architectuur (Fabric)** met
`ClassCastException: String cannot be cast …` (zie L11 in lessons.md). Het ziet er
in lint én in de statische render goed uit — de crash blijkt pas op toestel. Doe
dit dus niet. Veilige alternatieven:

**B1 — wrapper-"ademhaling" (Fabric-veilig, beweegt wel de hele badge).**
Een gewone `Animated.View`-transform is prima; geschikt voor een heel subtiele,
trage puls van de héle illustratie (stage + object samen):

```jsx
const t = useRef(new Animated.Value(0)).current;
useEffect(() => {
  if (prefersReducedMotion()) return undefined;
  const loop = Animated.loop(Animated.sequence([
    Animated.timing(t, { toValue: 1, duration: 2400, useNativeDriver: NATIVE_DRIVER }),
    Animated.timing(t, { toValue: 0, duration: 2400, useNativeDriver: NATIVE_DRIVER }),
  ]));
  loop.start();
  return () => loop.stop();
}, [t]);
const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
// <Animated.View style={{ transform: [{ scale }] }}><Illustration … /></Animated.View>
```

**B2 — `react-native-reanimated` voor deel-element-beweging.** Reanimated heeft
echte Fabric-SVG-ondersteuning; gebruik dat als je écht alléén het loof/de stoom
wilt animeren (niet de hele badge). Zwaarder, maar het werkt wel op Fabric.

Beoordeel de bedoelde beweging vooraf met de filmstrip; verifieer de uiteindelijke
keuze **op toestel** (de Fabric-crash is alleen daar zichtbaar — zie het
adb-recept onderaan).

## De beweging beoordelen — filmstrip
```bash
node .claude/skills/svg-illustraties/scripts/filmstrip.mjs <naam> --type entrance
```
Rendert keyframes naast elkaar (`.out/_filmstrip-<naam>-<type>.png`). Types:
`entrance`, `pulse`, `sway`. Het is een *preview* van de tussenstanden (easeOutCubic
≈ een spring), niet de runtime — maar genoeg om begin/eindstand en de "boog" van
de beweging te beoordelen vóór je 'm in `Animated` giet. Lees de PNG terug met de
Read-tool en oordeel: te traag/snel? overshoot gewenst? eindstand correct?

## Op toestel verifiëren (adb) — de enige plek waar Fabric-bugs opduiken
De statische render en lint missen runtime/Fabric-fouten (zie L11). Verifieer
animaties op het Android-toestel via USB+adb (`adb` in
`~/Library/Android/sdk/platform-tools`):

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
"$ADB" reverse tcp:8081 tcp:8081                 # toestel bereikt Metro op localhost
# dev-build openen → dev-client home → tik de 'Recently opened' localhost:8081-regel
# (of deep-link naar een route: huishoek://<route>)
"$ADB" exec-out screencap -p > /tmp/frame.png    # frame teruglezen met Read
"$ADB" logcat -d -t 200 | grep -iE "ClassCast|Exception|ReactNative"   # crashes
```

Tips: een **redbox** = JS/native-fout (lees 'm; `ClassCast … String` ⇒ L11). Een
**donker scherm met tandwiel** = dev-client nog niet in de app-bundle (wacht op de
eerste bundle, ~30s). Voor een ingelogde sessie redirect de root-guard alles buiten
`(tabs)` weg; een tijdelijk verificatiescherm hoort dus in `app/(tabs)/` (achteraf
verwijderen). Animatie-frames vangen: een reeks `screencap`s (≈0.4s latentie) of —
als de illustratie periodiek remount — wisselende byte-groottes tonen dat de
beweging loopt.
