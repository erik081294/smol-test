// Renderer over de genormaliseerde assistent-catalog (lib/assistantUi.js).
// Tekent uitsluitend nodes die de pure poortwachter heeft goedgekeurd; kent per
// node-type één rustige weergave uit de bestaande bouwstenen (DESIGN.md: een
// scherm verzint geen eigen knop of marge).
import React, { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Checkbox, T, Stack, Row } from './ui';
import { colors, space } from './theme';
import { parseBlocks } from './markdownLite';
import { toggleSelection } from './assistantActions';
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

function Node({ node, onAction }) {
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
    case 'confirm_action':
      // De HITL-bevestigingskaart (AI-8, plan 23 §4). Zonder onAction-bridge
      // (bv. in een preview-context) valt 'ie terug op de oude platte tekst —
      // er staat dan nooit stiekem iets uitvoerbaars.
      return onAction
        ? <ConfirmActionCard node={node} onAction={onAction} />
        : <T variant="body" color={colors.inkSoft}>{node.summary}</T>;
    default:
      return null;
  }
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
function ConfirmActionCard({ node, onAction }) {
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
      await onAction(node.actionId, decision, decision === 'confirm' ? sel : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card raised={false} style={{ backgroundColor: colors.surface }}>
      <Stack gap={space.sm}>
        <T variant="label">{node.summary}</T>
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

export function AssistantMessageView({ tree = [], onAction }) {
  if (tree.length === 0) return null;
  return (
    <Stack gap={space.sm}>
      {tree.map((node, i) => <View key={i}><Node node={node} onAction={onAction} /></View>)}
    </Stack>
  );
}
