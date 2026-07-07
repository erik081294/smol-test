// Renderer over de genormaliseerde assistent-catalog (lib/assistantUi.js).
// Tekent uitsluitend nodes die de pure poortwachter heeft goedgekeurd; kent per
// node-type één rustige weergave uit de bestaande bouwstenen (DESIGN.md: een
// scherm verzint geen eigen knop of marge).
import React, { useState } from 'react';
import { View, Image, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Checkbox, Stepper, T, Stack, Row } from './ui';
import { colors, space, radius } from './theme';
import { parseBlocks } from './markdownLite';
import { toggleSelection, confirmSequence } from './assistantActions';
import { pendingActionIds } from './assistantUi';
import {
  chartLayout, lineLayout, formatChartValue, progressFraction,
  scaleIngredients, MIN_SERVINGS, MAX_SERVINGS,
} from './assistantGenUi';
import { useSignedUrl } from './photoStorage';
import { t } from './i18n';

const spanStyle = (s) => [
  s.bold ? { fontWeight: '700' } : null,
  s.italic ? { fontStyle: 'italic' } : null,
  s.code ? {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    backgroundColor: colors.surfaceAlt,
  } : null,
];

// Markdown-subset van de assistent (AI-5): blokken/spans uit de pure parser
// (lib/markdownLite.js), getekend met de bestaande type-tokens — bold/cursief/
// code inline, kopjes als label, lijstregels met hun eigen marker.
export function MarkdownText({ text, color }) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <Stack gap={space.xs}>
      {blocks.map((b, i) => {
        const spans = b.spans.map((s, j) => (
          <T key={j} variant={b.type === 'heading' ? 'label' : 'body'} color={color} style={spanStyle(s)}>{s.text}</T>
        ));
        return b.type === 'bullet' ? (
          <Row key={i} gap={space.xs}>
            <T variant="body" color={color ?? colors.inkSoft}>{b.marker}</T>
            <T variant="body" color={color} style={{ flex: 1 }}>{spans}</T>
          </Row>
        ) : (
          <T key={i} variant={b.type === 'heading' ? 'label' : 'body'} color={color}>{spans}</T>
        );
      })}
    </Stack>
  );
}

function Node({ node, onAction, onEdit, onChoice, onConfirmed }) {
  switch (node.type) {
    case 'text':
      return <MarkdownText text={node.text} />;
    case 'card':
      return (
        <Card raised={false} style={{ backgroundColor: colors.surface }}>
          <Stack gap={space.xs}>
            {node.title ? (
              <Row gap={space.xs}>
                {node.emoji ? <T variant="body">{node.emoji}</T> : null}
                <T variant="label">{node.title}</T>
              </Row>
            ) : null}
            {node.lines.map((line, i) => <T key={i} variant="body" color={colors.inkSoft}>{line}</T>)}
          </Stack>
        </Card>
      );
    case 'list':
      return (
        <Card raised={false} style={{ backgroundColor: colors.surface }}>
          <Stack gap={space.xs}>
            {node.title ? <T variant="label">{node.title}</T> : null}
            {node.items.map((it, i) => (
              <Row key={i} gap={space.xs}>
                <T variant="body">{it.emoji ?? '•'}</T>
                <T variant="body" style={{ flex: 1 }}>{it.text}</T>
              </Row>
            ))}
          </Stack>
        </Card>
      );
    case 'keyvalue':
      return (
        <Card raised={false} style={{ backgroundColor: colors.surface }}>
          <Stack gap={space.xs}>
            {node.title ? <T variant="label">{node.title}</T> : null}
            {node.pairs.map((p, i) => (
              <Row key={i} justify="space-between">
                <T variant="body" color={colors.inkSoft}>{p.k}</T>
                <T variant="body">{p.v}</T>
              </Row>
            ))}
          </Stack>
        </Card>
      );
    case 'link':
      return (
        <Pressable onPress={() => router.push(node.route)} accessibilityRole="link" accessibilityLabel={node.label}>
          <T variant="body" color={colors.forest} style={{ textDecorationLine: 'underline' }}>{node.label}</T>
        </Pressable>
      );
    case 'recipe':
      return <RecipeCard node={node} />;
    case 'chart':
      return node.variant === 'line' ? <LineChartCard node={node} /> : <ChartCard node={node} />;
    case 'schedule':
      return <ScheduleCard node={node} />;
    case 'image':
      return <ImageCard node={node} />;
    case 'progress':
      return <ProgressCard node={node} />;
    case 'choice':
      // De beslis-kaart (AI-16): zonder verstuur-bridge (preview-context) tonen
      // we prompt + opties als rustige tekst — er staat dan niets tikbaars.
      return onChoice
        ? <ChoiceCard node={node} onChoice={onChoice} />
        : <T variant="body" color={colors.inkSoft}>{`${node.prompt} ${node.options.map((o) => o.label).join(' / ')}`}</T>;
    case 'confirm_action':
      // De HITL-bevestigingskaart (AI-8, plan 23 §4). Zonder onAction-bridge
      // (bv. in een preview-context) valt 'ie terug op de oude platte tekst —
      // er staat dan nooit stiekem iets uitvoerbaars.
      return onAction
        ? <ConfirmActionCard node={node} onAction={onAction} onEdit={onEdit} onConfirmed={onConfirmed} />
        : <T variant="body" color={colors.inkSoft}>{node.summary}</T>;
    default:
      return null;
  }
}

// De recept-kaart (AI-12, verrijkt in AI-16/plan 26): titel + porties,
// ingrediëntenlijst en genummerde bereiding. Draagt de kaart gestructureerde
// hoeveelheden én een porties-aantal, dan verschijnt de porties-stepper en
// herrekenen de ingrediëntregels live mee — puur en client-lokaal
// (scaleIngredients in lib/assistantGenUi.js); het opgeslagen voorstel (HITL)
// verandert hier bewust niet door mee.
function RecipeCard({ node }) {
  const [servings, setServings] = useState(node.servings);
  const scalable = node.servings != null && node.ingredients.some((it) => it.quantity != null && it.name);
  const shown = scalable ? scaleIngredients(node.ingredients, node.servings, servings) : node.ingredients;
  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.sm}>
        <Stack gap={2}>
          {node.title ? <T variant="label">{node.title}</T> : null}
          {node.servings && !scalable ? (
            <T variant="caption" color={colors.inkSoft}>{t('assistant.recipe.servings', { n: node.servings })}</T>
          ) : null}
        </Stack>
        {scalable ? (
          <Row justify="space-between" style={{ alignItems: 'center' }}>
            <Stack gap={2} style={{ flex: 1 }}>
              <T variant="caption" color={colors.inkSoft}>{t('assistant.recipe.servings', { n: servings })}</T>
              {servings !== node.servings ? (
                <T variant="caption" color={colors.forest}>{t('assistant.recipe.scaledFor', { n: servings })}</T>
              ) : null}
            </Stack>
            <Stepper
              value={servings}
              onChange={setServings}
              min={MIN_SERVINGS}
              max={MAX_SERVINGS}
              compact
              accessibilityLabel={t('assistant.recipe.servingsStepper')}
            />
          </Row>
        ) : null}
        {shown.length > 0 ? (
          <Stack gap={space.xs}>
            <T variant="label" color={colors.inkSoft}>{t('assistant.recipe.ingredients')}</T>
            {shown.map((it, i) => (
              <Row key={i} gap={space.xs}>
                <T variant="body" color={colors.inkSoft}>•</T>
                <T variant="body" style={{ flex: 1 }}>{it.text}</T>
              </Row>
            ))}
          </Stack>
        ) : null}
        {node.steps.length > 0 ? (
          <Stack gap={space.xs}>
            <T variant="label" color={colors.inkSoft}>{t('assistant.recipe.steps')}</T>
            {node.steps.map((step, i) => (
              <Row key={i} gap={space.xs}>
                <T variant="body" color={colors.forest}>{i + 1}.</T>
                <T variant="body" style={{ flex: 1 }}>{step}</T>
              </Row>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

// Interactieve staafgrafiek (AI-16, plan 26 — dataviz-methode): één serie, één
// hue (forest), dunne staven met afgeronde datatop op een basislijn, recessief
// grid op "nice" waarden. Relief is verplicht (donker thema haalt forest op
// surface geen 3:1): de hoogste én de geselecteerde staaf dragen een zichtbaar
// waarde-label, elke staaf een a11y-label, en treeToText blijft de tabelvorm.
// Tik = inspecteren (selectie in forestSoft, het pressed-token), nogmaals = weg.
const CHART_PLOT_HEIGHT = 120;

function ChartCard({ node }) {
  const [selected, setSelected] = useState(null);
  const layout = chartLayout(node.points);
  if (!layout) return null;
  const maxIndex = layout.bars.reduce((best, b, i) => (b.value > layout.bars[best].value ? i : best), 0);
  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.sm}>
        {node.title ? <T variant="label">{node.title}</T> : null}
        <View style={{ height: CHART_PLOT_HEIGHT, justifyContent: 'flex-end' }}>
          {/* Recessief grid: hulplijn op de helft en de top van de nice-as. */}
          {layout.ticks.map((tick) => (
            <View
              key={tick}
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, right: 0,
                bottom: (tick / layout.max) * (CHART_PLOT_HEIGHT - 18),
                borderTopWidth: 1, borderTopColor: colors.line,
              }}
            >
              <T variant="caption" color={colors.inkFaint} style={{ alignSelf: 'flex-end' }}>
                {formatChartValue(tick, node.unit)}
              </T>
            </View>
          ))}
          <Row gap={space.xs} style={{ alignItems: 'flex-end', height: CHART_PLOT_HEIGHT - 18 }}>
            {layout.bars.map((bar, i) => {
              const isSelected = selected === i;
              const labeled = isSelected || (selected === null && i === maxIndex && bar.value > 0);
              const barHeight = Math.max(bar.value > 0 ? 3 : 2, Math.round(bar.frac * (CHART_PLOT_HEIGHT - 18)));
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelected(isSelected ? null : i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t('assistant.chart.bar', { label: bar.label, value: formatChartValue(bar.value, node.unit) })}
                  style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
                >
                  {labeled ? (
                    <T variant="caption" color={colors.ink} numberOfLines={1} style={{ marginBottom: 2 }}>
                      {formatChartValue(bar.value, node.unit)}
                    </T>
                  ) : null}
                  <View
                    style={{
                      alignSelf: 'stretch',
                      height: barHeight,
                      backgroundColor: bar.value > 0 ? (isSelected ? colors.forestSoft : colors.forest) : colors.lineStrong,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                    }}
                  />
                </Pressable>
              );
            })}
          </Row>
        </View>
        {/* Basislijn + x-labels in ink-tokens (tekst draagt nooit de seriekleur). */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.lineStrong, marginTop: -space.sm }} />
        <Row gap={space.xs} style={{ marginTop: -space.xs }}>
          {layout.bars.map((bar, i) => (
            <T key={i} variant="caption" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
              {bar.label}
            </T>
          ))}
        </Row>
      </Stack>
    </Card>
  );
}

// Lijn-variant van de grafiek (AI-16 ronde 3, trends over maanden): zelfde
// nice-as/grid/relief-regels als de staaf; de lijn zelf is dots + geroteerde
// View-segmenten (geen SVG-dependency — lineLayout levert px-coördinaten na
// één onLayout-meting). Tik op een kolom = inspecteren, nogmaals = weg; zonder
// selectie draagt de hoogste dot het waarde-label.
function LineChartCard({ node }) {
  const [selected, setSelected] = useState(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const plotHeight = CHART_PLOT_HEIGHT - 18;
  const layout = plotWidth > 0 ? lineLayout(node.points, plotWidth, plotHeight) : null;
  const maxIndex = layout
    ? layout.dots.reduce((best, d, i) => (d.value > layout.dots[best].value ? i : best), 0)
    : 0;
  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.sm}>
        {node.title ? <T variant="label">{node.title}</T> : null}
        <View
          style={{ height: CHART_PLOT_HEIGHT, justifyContent: 'flex-end' }}
          onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
        >
          {layout ? layout.ticks.map((tick) => (
            <View
              key={tick}
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, right: 0,
                bottom: (tick / layout.max) * plotHeight,
                borderTopWidth: 1, borderTopColor: colors.line,
              }}
            >
              <T variant="caption" color={colors.inkFaint} style={{ alignSelf: 'flex-end' }}>
                {formatChartValue(tick, node.unit)}
              </T>
            </View>
          )) : null}
          {layout ? (
            <View style={{ height: plotHeight }}>
              {layout.segments.map((s, i) => (
                <View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: 'absolute', left: s.left, top: s.top - 1,
                    width: s.length, height: 2, borderRadius: 1,
                    backgroundColor: colors.forest,
                    transform: [{ rotate: `${s.angle}rad` }],
                  }}
                />
              ))}
              {layout.dots.map((d, i) => {
                const isSelected = selected === i;
                const labeled = isSelected || (selected === null && i === maxIndex && d.value > 0);
                return (
                  <React.Fragment key={i}>
                    {labeled ? (
                      <T
                        variant="caption" color={colors.ink} numberOfLines={1}
                        style={{
                          position: 'absolute',
                          left: Math.min(Math.max(0, d.x - 40), Math.max(0, plotWidth - 80)),
                          top: Math.max(0, d.y - 20),
                          width: 80, textAlign: 'center',
                        }}
                      >
                        {formatChartValue(d.value, node.unit)}
                      </T>
                    ) : null}
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute', left: d.x - 4, top: d.y - 4,
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: isSelected ? colors.forestSoft : colors.forest,
                      }}
                    />
                  </React.Fragment>
                );
              })}
              {/* Tik-doelen: onzichtbare kolommen over de volle plothoogte. */}
              <Row style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
                {layout.dots.map((d, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setSelected(selected === i ? null : i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected === i }}
                    accessibilityLabel={t('assistant.chart.bar', { label: d.label, value: formatChartValue(d.value, node.unit) })}
                    style={{ flex: 1, height: '100%' }}
                  />
                ))}
              </Row>
            </View>
          ) : null}
        </View>
        {/* Basislijn + x-labels — identiek aan de staaf-variant (één systeem). */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.lineStrong, marginTop: -space.sm }} />
        <Row gap={space.xs} style={{ marginTop: -space.xs }}>
          {node.points.map((p, i) => (
            <T key={i} variant="caption" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
              {p.label}
            </T>
          ))}
        </Row>
      </Stack>
    </Card>
  );
}

// Foto-node (AI-16 ronde 3): het pad wordt client-side gesigneerd via de
// RLS-gescopete storage-API (useSignedUrl) — de server stuurt nooit een URL,
// dus buiten je huishouden valt er niets te tonen. Zolang er geen URL is
// (laden of geen toegang) staat er een rustige placeholder; de caption blijft
// altijd leesbaar (a11y + treeToText).
function ImageCard({ node }) {
  const url = useSignedUrl(node.bucket, node.path);
  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.xs}>
        {url ? (
          <Image
            source={{ uri: url }}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel={node.caption ?? t('assistant.image.photo')}
            style={{ width: '100%', height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
          />
        ) : (
          <View style={{ width: '100%', height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }} />
        )}
        {node.caption ? <T variant="caption" color={colors.inkSoft}>{node.caption}</T> : null}
      </Stack>
    </Card>
  );
}

// Voortgangs-node (AI-16 ronde 3): rustige balk in forest op een gedimde
// track, met de teller ("5 van 12") als tekst — de balk is illustratie, de
// tekst het feit (de a11y-value draagt dezelfde getallen).
function ProgressCard({ node }) {
  const frac = progressFraction(node.value, node.max);
  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.xs}>
        <Row justify="space-between" gap={space.sm}>
          <T variant="label" style={{ flex: 1 }}>{node.label}</T>
          <T variant="body" color={colors.inkSoft}>{t('assistant.progress.count', { value: node.value, max: node.max })}</T>
        </Row>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: node.max, now: node.value }}
          style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
        >
          <View style={{ width: `${frac * 100}%`, height: '100%', borderRadius: 4, backgroundColor: colors.forest }} />
        </View>
      </Stack>
    </Card>
  );
}

// Week-/dagrooster (AI-16, plan 26): dag-rijen met een rustig vast daglabel;
// vandaag krijgt een forest-accentbalkje + "vandaag". Lege dagen tonen "—" —
// een gat in het menu is óók informatie. Geen verstopte tikdoelen (UX-42):
// navigatie loopt via een losse link-node.
function ScheduleCard({ node }) {
  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.sm}>
        {node.title ? <T variant="label">{node.title}</T> : null}
        <Stack gap={space.xs}>
          {node.days.map((day, i) => (
            <Row key={i} gap={space.sm} style={{ alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 3, alignSelf: 'stretch', borderRadius: 2,
                  backgroundColor: day.today ? colors.forest : 'transparent',
                }}
              />
              <Stack gap={0} style={{ width: 72 }}>
                <T variant="label" color={day.today ? colors.forest : colors.inkSoft}>{day.label}</T>
                {day.today ? <T variant="caption" color={colors.forest}>{t('assistant.schedule.today')}</T> : null}
              </Stack>
              <Stack gap={2} style={{ flex: 1 }}>
                {day.entries.length > 0 ? (
                  day.entries.map((e, j) => (
                    <Row key={j} gap={space.xs}>
                      {e.emoji ? <T variant="body">{e.emoji}</T> : null}
                      <T variant="body" style={{ flex: 1 }}>{e.text}</T>
                    </Row>
                  ))
                ) : (
                  <T variant="body" color={colors.inkFaint}>{t('assistant.schedule.empty')}</T>
                )}
              </Stack>
            </Row>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}

// Beslis-kaart (AI-16, AskUserQuestion-patroon): opties mét context; een tik
// stuurt de reply als gewone gebruikersbeurt (zelfde route als vrij typen —
// geen args, geen tools, de HITL-keten blijft onaangeroerd). Het invoerveld
// blijft altijd beschikbaar: opties versnellen, beperken nooit (guidelines §8).
function ChoiceCard({ node, onChoice }) {
  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.sm}>
        <T variant="label">{node.prompt}</T>
        {node.options.map((opt, i) => (
          <Pressable
            key={i}
            onPress={() => onChoice(opt.reply)}
            accessibilityRole="button"
            accessibilityLabel={opt.description ? `${opt.label} — ${opt.description}` : opt.label}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: pressed ? colors.forest : colors.line,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.forestTint : colors.surface,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              minHeight: 48,
              justifyContent: 'center',
            })}
          >
            <T variant="body" style={{ fontWeight: '600' }}>{opt.label}</T>
            {opt.description ? <T variant="caption" color={colors.inkSoft}>{opt.description}</T> : null}
          </Pressable>
        ))}
      </Stack>
    </Card>
  );
}

// Afgehandelde staten → één rustige regel op een gedimde kaart (plan 23 §3).
const ACTION_STATE_COPY = {
  done: () => `✓ ${t('assistant.action.done')}`,
  undone: () => t('assistant.action.undone'),
  rejected: () => t('assistant.action.rejected'),
  failed: () => t('assistant.action.failed'),
  expired: () => t('assistant.action.expired'),
};

// De bevestigingskaart: wát er gebeurt in mensentaal, per item aan/uitvinkbaar
// (multi-edit), en twee even grote knoppen — weigeren is even makkelijk als
// bevestigen (Doen gevuld / Niet doen ghost, touch-targets ≥48dp via Button).
function ConfirmActionCard({ node, onAction, onEdit, onConfirmed }) {
  const [selected, setSelected] = useState(() => node.items.map((it) => it.id));
  const [busy, setBusy] = useState(false);
  const status = node.status ?? 'pending';

  if (status !== 'pending' && status !== 'executing') {
    const copy = ACTION_STATE_COPY[status];
    return (
      <Card raised={false} style={{ backgroundColor: colors.surface, opacity: 0.6 }}>
        <Stack gap={space.xs}>
          <T variant="label" color={colors.inkSoft}>{node.summary}</T>
          {copy ? <T variant="body" color={colors.inkSoft}>{copy()}</T> : null}
        </Stack>
      </Card>
    );
  }

  const resolve = async (decision) => {
    setBusy(true);
    try {
      // Alles aangevinkt = geen selectie meesturen (de server voert dan de
      // volledige opgeslagen args uit); anders alleen de aangevinkte indexen.
      const sel = selected.length === node.items.length ? undefined : selected;
      const ok = await onAction(node.actionId, decision, decision === 'confirm' ? sel : undefined);
      // "Bevestigen is een beurt" (AI-18): na een geslaagd akkoord reageert de
      // assistent met een korte bevestiging + eventuele vervolgstap.
      if (ok && decision === 'confirm') onConfirmed?.([node.actionId]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.sm}>
        <Row justify="space-between">
          <T variant="label" style={{ flex: 1 }}>{node.summary}</T>
          {onEdit ? (
            // Mens↔AI-overdracht (AI-10): de gebruiker neemt het voorstel over,
            // bewerkt de velden zelf en de AI rekent daarna verder met zíjn versie.
            <Pressable onPress={() => onEdit(node.actionId)} disabled={busy}
              accessibilityRole="button" accessibilityLabel={t('assistant.action.edit')}
              style={{ minHeight: 32, justifyContent: 'center' }}>
              <T variant="body" color={colors.forest} style={{ textDecorationLine: 'underline' }}>
                {t('assistant.action.edit')}
              </T>
            </Pressable>
          ) : null}
        </Row>
        {node.items.length === 1 ? (
          <T variant="body" color={colors.inkSoft}>{node.items[0].text}</T>
        ) : (
          node.items.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => setSelected((prev) => toggleSelection(prev, it.id))}
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.includes(it.id) }}
              accessibilityLabel={it.text}
              style={{ minHeight: 32 }}
            >
              <Row gap={space.sm}>
                <Checkbox
                  checked={selected.includes(it.id)}
                  onPress={() => setSelected((prev) => toggleSelection(prev, it.id))}
                  accessibilityLabel={it.text}
                />
                <T variant="body" style={{ flex: 1 }}>{it.text}</T>
              </Row>
            </Pressable>
          ))
        )}
        <Row gap={space.sm}>
          <Button
            title={t('assistant.action.confirm')}
            onPress={() => resolve('confirm')}
            loading={busy && status !== 'executing'}
            disabled={busy || selected.length === 0}
            fullWidth={false}
            style={{ flex: 1 }}
          />
          <Button
            title={t('assistant.action.reject')}
            variant="ghost"
            onPress={() => resolve('reject')}
            disabled={busy}
            fullWidth={false}
            style={{ flex: 1 }}
          />
        </Row>
      </Stack>
    </Card>
  );
}

// "Akkoord met alles" (AI-12): bundelt de nog-openstaande voorstellen van één
// beurt tot één tik. Elke actie blijft server-side atomair — de knop bevestigt
// ze na elkaar via hetzelfde onAction-endpoint (geen selectie = de volle
// opgeslagen args). Faalt er één, dan stoppen we en tonen de losse kaarten hun
// eigen status; de rest kan de gebruiker per kaart afhandelen.
function BulkConfirm({ actionIds, onAction, onConfirmed }) {
  const [busy, setBusy] = useState(false);
  // De kaart kan mid-loop unmounten: zodra een confirm slaagt zakt het aantal
  // openstaande voorstellen onder de ≥2-drempel en verdwijnt deze knop. Guard
  // de setBusy zodat we niet op een verdwenen component schrijven.
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);
  const confirmAll = async () => {
    setBusy(true);
    // Stopt bij het eerste voorstel dat faalt (resolveAction geeft true/false);
    // de rest blijft open en per kaart afhandelbaar.
    const confirmed = await confirmSequence(actionIds, (id) => onAction(id, 'confirm', undefined));
    // Eén vervolg-beurt voor de hele bundel (AI-18) — niet per voorstel.
    if (confirmed > 0) onConfirmed?.(actionIds.slice(0, confirmed));
    if (mounted.current) setBusy(false);
  };
  return (
    <Button
      title={t('assistant.action.confirmAll', { n: actionIds.length })}
      onPress={confirmAll}
      loading={busy}
      disabled={busy}
      testID="t-assistant-confirm-all"
    />
  );
}

export function AssistantMessageView({ tree = [], onAction, onEdit, onChoice, onConfirmed }) {
  if (tree.length === 0) return null;
  const bulkIds = onAction ? pendingActionIds(tree) : [];
  return (
    <Stack gap={space.sm}>
      {tree.map((node, i) => <View key={i}><Node node={node} onAction={onAction} onEdit={onEdit} onChoice={onChoice} onConfirmed={onConfirmed} /></View>)}
      {bulkIds.length >= 2 ? <BulkConfirm actionIds={bulkIds} onAction={onAction} onConfirmed={onConfirmed} /> : null}
    </Stack>
  );
}
