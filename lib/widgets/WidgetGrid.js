/* eslint-disable react-hooks/immutability -- Reanimated-worklets muteren SharedValue.value bewust (de regel ziet shared values ten onrechte als onveranderbaar). */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, runOnJS,
} from 'react-native-reanimated';
import { packGrid } from './grid';
import { WIDGET_BY_KEY } from './registry';
import { prefersReducedMotion } from '../motion';
import { tapLight } from '../haptics';

// Absoluut-gepositioneerde widget-grid met vinger-drag-herschikking (VDG-3). In
// bewerkmodus wordt een tegel na een long-press "opgetild" (schaal + schaduw, volgt
// je vinger) en schuiven de andere widgets realtime naar hun nieuwe plek terwijl je
// eroverheen sleept; bij loslaten valt 'ie in z'n nieuwe slot. Buiten bewerkmodus is
// het een gewone (statische) grid en blijft tikken navigeren.
//
// Mixed-size (1×1/2×1) blijft hanteerbaar door uniforme celhoogte: de pure packGrid
// levert col/row, hier omgezet naar pixels. De drag is een 1D-herordening (de
// dragged-key naar de index van de cel onder je vinger), waarna packGrid herpakt.

const SPRING = { damping: 20, stiffness: 220, mass: 0.7 };

// Verplaats `key` naar `index` in een keys-array (puur, lokaal).
function moveKeyToIndex(keys, key, index) {
  const from = keys.indexOf(key);
  if (from === -1) return keys;
  const next = [...keys];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(index, next.length)), 0, key);
  return next;
}

export function WidgetGrid({
  layout, editing, widgetStyle, tasks, members,
  colW, contentW, gap, tileH, controlH, onReorder, renderControls,
}) {
  const reduce = prefersReducedMotion();
  const cellH = tileH + (editing ? controlH : 0);
  const rowH = cellH + gap;

  // Live volgorde tijdens het slepen; gesynct vanaf de prop als we niet slepen.
  const draggingRef = useRef(false);
  const [order, setOrder] = useState(() => layout.map((p) => p.key));
  useEffect(() => {
    if (!draggingRef.current) setOrder(layout.map((p) => p.key));
  }, [layout]);

  const sizeByKey = useMemo(
    () => Object.fromEntries(layout.map((p) => [p.key, p.size])),
    [layout],
  );

  // Pixel-rects per key uit packGrid (op de live volgorde).
  const { rectByKey, height } = useMemo(() => {
    const placements = order.map((k) => ({ key: k, size: sizeByKey[k] ?? '1x1' }));
    const cells = packGrid(placements, { cols: 2 });
    const map = {};
    let maxRow = 0;
    for (const c of cells) {
      map[c.key] = {
        x: c.col * (colW + gap),
        y: c.row * rowH,
        w: c.w === 2 ? contentW : colW,
      };
      maxRow = Math.max(maxRow, c.row);
    }
    return { rectByKey: map, height: cells.length ? (maxRow + 1) * rowH - gap : 0 };
  }, [order, sizeByKey, colW, contentW, gap, rowH]);

  // Gedeelde drag-staat (één actieve tegel tegelijk).
  const activeKey = useSharedValue(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);

  const lastTarget = useRef(-1);

  // Live refs zodat de (stabiele) drag-callbacks altijd de actuele staat lezen —
  // de gesture wordt bewust niet herbouwd tijdens een sleep, dus closures mogen niet
  // op verouderde `order`/rects leunen (anders snapt 'ie bij loslaten terug). In een
  // effect gesynct (niet tijdens render); de callbacks vuren ná commit, dus actueel.
  const orderRef = useRef(order);
  const rectRef = useRef(rectByKey);
  const sizeRef = useRef(sizeByKey);
  const cellHRef = useRef(cellH);
  const onReorderRef = useRef(onReorder);
  useEffect(() => {
    orderRef.current = order;
    rectRef.current = rectByKey;
    sizeRef.current = sizeByKey;
    cellHRef.current = cellH;
    onReorderRef.current = onReorder;
  });

  const onDragStart = useCallback(() => { draggingRef.current = true; tapLight(); }, []);
  const onDragMove = useCallback((key, cx, cy) => {
    // Cel onder het midden van de gesleepte tegel zoeken → diens index wordt de target.
    const ord = orderRef.current; const rects = rectRef.current; const ch = cellHRef.current;
    let targetKey = null;
    for (const k of ord) {
      const r = rects[k];
      if (!r) continue;
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + ch) { targetKey = k; break; }
    }
    if (!targetKey || targetKey === key) return;
    const targetIndex = ord.indexOf(targetKey);
    if (targetIndex === lastTarget.current) return;
    lastTarget.current = targetIndex;
    setOrder((cur) => moveKeyToIndex(cur, key, targetIndex));
  }, []);
  const onDragEnd = useCallback(() => {
    draggingRef.current = false;
    lastTarget.current = -1;
    onReorderRef.current(orderRef.current.map((k) => ({ key: k, size: sizeRef.current[k] ?? '1x1' })));
  }, []);

  if (!order.length) return null;

  return (
    <View style={{ height, marginBottom: gap }}>
      {order.map((key, index) => {
        const descriptor = WIDGET_BY_KEY[key];
        const rect = rectByKey[key];
        if (!descriptor || !rect) return null;
        return (
          <DragCell
            key={key}
            cellKey={key}
            index={index}
            rect={rect}
            cellH={cellH}
            tileH={tileH}
            editing={editing}
            reduce={reduce}
            shared={{ activeKey, dragX, dragY, grabX, grabY }}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          >
            <View pointerEvents={editing ? 'none' : 'auto'} style={{ height: tileH, overflow: 'hidden' }}>
              <descriptor.Render size={sizeByKey[key]} style={widgetStyle} tasks={tasks} members={members} />
            </View>
            {editing ? renderControls(key) : null}
          </DragCell>
        );
      })}
    </View>
  );
}

function DragCell({ cellKey, index, rect, cellH, editing, reduce, shared, onDragStart, onDragMove, onDragEnd, children }) {
  const { activeKey, dragX, dragY, grabX, grabY } = shared;
  // Spiegel de doel-positie naar shared values (in een effect, niet tijdens render),
  // zodat de gesture-worklets een stabiele referentie hebben.
  const baseX = useSharedValue(rect.x);
  const baseY = useSharedValue(rect.y);
  // baseX/baseY zijn stabiele shared refs; alleen op rect-wijziging hersynchroniseren.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { baseX.value = rect.x; baseY.value = rect.y; }, [rect.x, rect.y]);

  // Eenmalige, gestaggerde entree (fade-in) bij het eerste mounten — een nieuwe tegel
  // (in bewerkmodus toegevoegd) fadet apart in. No-op bij "verminder beweging". Speelt
  // niet opnieuw bij herschikken/data-refresh, want de tegel-key (en dus deze cel)
  // blijft gemount.
  const appear = useSharedValue(reduce ? 1 : 0);
  // Mount-once (geen deps): de stagger leunt op de index bij het eerste renderen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!reduce) appear.value = withDelay(index * 45, withTiming(1, { duration: 280 })); }, []);

  const halfW = rect.w / 2;
  const halfH = cellH / 2;

  // Long-press → optillen → herschikken werkt in béíde modi (UX-25): buiten
  // bewerkmodus blijft een korte tik navigeren (de Pan activeert pas na 220ms
  // ingedrukt houden, dus een tik/scroll-fling triggert 'm niet). In bewerkmodus
  // staat de inhoud op pointerEvents:none zodat tikken niet navigeert.
  const pan = useMemo(() => Gesture.Pan()
    .enabled(true)
    .activateAfterLongPress(220)
    .onStart(() => {
      activeKey.value = cellKey;
      grabX.value = baseX.value;
      grabY.value = baseY.value;
      dragX.value = 0;
      dragY.value = 0;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      runOnJS(onDragMove)(cellKey, grabX.value + e.translationX + halfW, grabY.value + e.translationY + halfH);
    })
    .onEnd(() => {
      activeKey.value = null;
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      if (activeKey.value === cellKey) activeKey.value = null;
    }),
  // Bewust stabiel: shared values + callbacks horen niet de gesture te herbouwen
  // (zou een lopende sleep afbreken). Recreëren alleen als de geometrie/modus wijzigt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [editing, cellKey, halfW, halfH]);

  const animStyle = useAnimatedStyle(() => {
    const active = activeKey.value === cellKey;
    if (active) {
      return {
        left: grabX.value + dragX.value,
        top: grabY.value + dragY.value,
        opacity: 1,
        zIndex: 999,
        transform: [{ scale: withSpring(1.04, SPRING) }],
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 }, elevation: 12,
      };
    }
    return {
      left: reduce ? baseX.value : withSpring(baseX.value, SPRING),
      top: reduce ? baseY.value : withSpring(baseY.value, SPRING),
      opacity: appear.value,
      zIndex: 1,
      transform: [{ scale: withSpring(1, SPRING) }],
      shadowOpacity: 0, elevation: 0,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ position: 'absolute', width: rect.w }, animStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
