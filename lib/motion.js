// Beweging — kort en zacht, en altijd met respect voor "verminder beweging".
//
// Twee dingen op één plek, zodat schermen niet zelf met LayoutAnimation of
// AccessibilityInfo hoeven te knoeien:
//   • animateNextLayout() — animeert de eerstvolgende layout-wijziging (een rij
//     die verschijnt/verdwijnt/verschuift). Roep 'm aan vlak vóór de state-
//     mutatie die de lijst verandert.
//   • prefersReducedMotion() — synchroon op te vragen vlag; animaties slaan we
//     dan over (DESIGN.md "verminder beweging").
//
// Bewust op de ingebouwde Animated/LayoutAnimation i.p.v. een zware lib: dit is
// micro-polish, geen animatie-framework.

import { LayoutAnimation, Platform, UIManager, AccessibilityInfo } from 'react-native';
import { motion } from './theme';

// Android (oude architectuur) moet LayoutAnimation expliciet aanzetten. Op de New
// Architecture (Fabric) is deze call een no-op die luid waarschuwt — daar overslaan.
const isFabric = !!global?.nativeFabricUIManager;
if (Platform.OS === 'android' && !isFabric && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Gecachte "verminder beweging"-vlag. We lezen 'm één keer uit en luisteren naar
// wijzigingen, zodat de check synchroon en goedkoop blijft op de hot path.
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => { reduceMotion = !!v; })
  .catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => { reduceMotion = !!v; });

export const prefersReducedMotion = () => reduceMotion;

// Zachte easeInEaseOut-overgang voor de eerstvolgende layout-wijziging. No-op bij
// "verminder beweging" en op web — react-native-web ondersteunt LayoutAnimation
// niet betrouwbaar (configureNext kan gooien), en dat zou de actie die erop volgt
// blokkeren. Defensief omhuld zodat een mutatie nooit struikelt over de animatie.
export const supportsLayoutAnimation = Platform.OS === 'ios' || Platform.OS === 'android';

export function animateNextLayout(duration = motion.base) {
  if (reduceMotion || !supportsLayoutAnimation) return;
  try {
    LayoutAnimation.configureNext({
      duration,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  } catch {
    // Animatie is bijzaak; een platform dat 'm niet snapt mag 'm stil overslaan.
  }
}
