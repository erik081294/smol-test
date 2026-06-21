// Optionele native-modules voor herinneringen. expo-notifications/expo-device zijn
// native modules: ze zitten alléén in een dev-build die ná het toevoegen van de
// notificatie-feature (PLT-1) is gemaakt. Een oudere dev-client (of Expo Go) mist
// ze, waardoor de top-level import van expo-notifications throwt op
// `Cannot find native module 'ExpoPushTokenManager'` — en dat sloopt de hele app.
//
// Daarom laden we ze hier defensief via require-in-try/catch. Ontbreken ze, dan is
// `hasNotifications` false en schakelt useNotifications zichzelf stil uit — exact in
// lijn met de bestaande 'web/zonder hardware = stil no-op'-aanpak. Op een correcte
// dev-build zijn de modules wél aanwezig en verandert dit niets.

let Notifications = null;
let Device = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch {
  // native module niet in deze build → notificaties stil uitgeschakeld
}

export const hasNotifications = !!(Notifications && Device);
export { Notifications, Device };
