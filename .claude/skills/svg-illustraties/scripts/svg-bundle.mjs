// Mini-bundler: evalueer een react-native-svg illustratie-bron tot een echte
// module, met geshimde imports, zodat we de COMPONENT (niet een handgekopieerde
// SVG) kunnen renderen naar standalone SVG.
//
// Waarom dit bestaat: de illustraties leven als react-native-svg JSX, niet als
// .svg-bestanden. react-native-svg-primitieven mappen 1-op-1 op SVG-DOM-tags,
// dus we vervangen `react-native-svg` door dunne shims die echte <svg>/<circle>/…
// elementen maken. react-dom/server zet camelCase-props (strokeWidth) vanzelf om
// naar SVG-attributen (stroke-width). `react-native` en relatieve imports
// (./theme) worden ook afgevangen, zodat de bron ongewijzigd blijft.

import { readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { transformSync } from '@babel/core';
import React from 'react';
import * as ReactJSX from 'react/jsx-runtime';

// Babel-plugins via absolute paden: zo hoeft babel ze niet relatief aan cwd te
// resolven (preset-react ontbreekt soms; de losse plugins zitten er wél in).
const require = createRequire(import.meta.url);
const JSX_PLUGIN = require.resolve('@babel/plugin-transform-react-jsx');
const CJS_PLUGIN = require.resolve('@babel/plugin-transform-modules-commonjs');

// react-native-svg component → SVG-tag. Dekt de hele API die dit project gebruikt
// plus de gangbare rest (gradients, clip, mask) voor toekomstige illustraties.
const SVG_TAGS = {
  Svg: 'svg', G: 'g', Circle: 'circle', Rect: 'rect', Path: 'path',
  Ellipse: 'ellipse', Line: 'line', Polygon: 'polygon', Polyline: 'polyline',
  Text: 'text', TSpan: 'tspan', Defs: 'defs', LinearGradient: 'linearGradient',
  RadialGradient: 'radialGradient', Stop: 'stop', ClipPath: 'clipPath',
  Use: 'use', Mask: 'mask', Symbol: 'symbol',
};

function makeSvgShim() {
  const mod = {};
  for (const [name, tag] of Object.entries(SVG_TAGS)) {
    mod[name] = function SvgPrimitive({ children, ...props }) {
      if (tag === 'svg') {
        props.xmlns = 'http://www.w3.org/2000/svg';
        // Standalone rasterizeren wil een echte intrinsieke maat; "100%" → viewBox.
        const vb = (props.viewBox || '0 0 120 120').trim().split(/\s+/).map(Number);
        if (props.width == null || String(props.width).includes('%')) props.width = vb[2];
        if (props.height == null || String(props.height).includes('%')) props.height = vb[3];
      }
      return React.createElement(tag, props, children);
    };
  }
  mod.default = mod.Svg;
  Object.defineProperty(mod, '__esModule', { value: true }); // correcte default-interop
  return mod;
}

// Passthrough-component: rendert de kinderen, negeert (animated) style. Zo levert
// de statische render altijd de EINDSTAND op (volle opacity, scale 1), niet de
// beginstand van een entree-animatie.
const passthrough = ({ children }) => children ?? null;
function AnimatedValue(v) { this._v = v; }
AnimatedValue.prototype.interpolate = () => 0;
AnimatedValue.prototype.setValue = () => {};
const animStub = () => ({ start: () => {}, stop: () => {} });

const reactNativeShim = {
  __esModule: true,
  View: passthrough,
  Platform: { OS: 'web', select: (o) => o?.web ?? o?.default ?? o?.ios ?? o?.android },
  // Animated: alle bewegingen zijn no-ops; View/Text/Image zijn passthroughs zodat
  // de render de bedoelde eindstand toont (de filmstrip toont de tussenstanden).
  Animated: {
    View: passthrough, Text: passthrough, Image: passthrough, ScrollView: passthrough,
    Value: AnimatedValue,
    timing: animStub, spring: animStub, decay: animStub,
    loop: animStub, sequence: animStub, parallel: animStub, stagger: animStub, delay: animStub,
    createAnimatedComponent: (C) => C,
  },
  // motion.js raakt deze RN-API's aan bij import — benigne stubs zodat het laden lukt.
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
  UIManager: { setLayoutAnimationEnabledExperimental: () => {} },
  LayoutAnimation: { configureNext: () => {}, Types: { easeInEaseOut: 'easeInEaseOut' }, Properties: { opacity: 'opacity' } },
  Easing: { in: () => (t) => t, out: () => (t) => t, inOut: () => (t) => t, ease: (t) => t, cubic: (t) => t },
};

function makeRequire(fromDir, cache) {
  return function req(spec) {
    if (spec === 'react') return React;
    if (spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') return ReactJSX;
    if (spec === 'react-native') return reactNativeShim;
    if (spec === 'react-native-svg') return makeSvgShim();
    if (spec.startsWith('.')) {
      let p = resolve(fromDir, spec);
      if (!extname(p)) p = p + '.js';
      return loadModule(p, cache);
    }
    throw new Error(`svg-bundle: onbekende import "${spec}" (vanuit ${fromDir})`);
  };
}

// Babel-transform (JSX + ESM→CJS) en evalueer; recursief voor relatieve imports.
export function loadModule(absPath, cache = new Map()) {
  if (cache.has(absPath)) return cache.get(absPath);
  const src = readFileSync(absPath, 'utf8');
  const { code } = transformSync(src, {
    filename: absPath,
    babelrc: false,
    configFile: false,
    plugins: [
      [JSX_PLUGIN, { runtime: 'automatic', development: false }],
      CJS_PLUGIN,
    ],
  });
  const module = { exports: {} };
  cache.set(absPath, module.exports); // cyclus-veilig (placeholder)
  const fn = new Function('require', 'module', 'exports', code);
  fn(makeRequire(dirname(absPath), cache), module, module.exports);
  cache.set(absPath, module.exports);
  return module.exports;
}
