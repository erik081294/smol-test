// Renderer over de genormaliseerde assistent-catalog (lib/assistantUi.js).
// Tekent uitsluitend nodes die de pure poortwachter heeft goedgekeurd; kent per
// node-type één rustige weergave uit de bestaande bouwstenen (DESIGN.md: een
// scherm verzint geen eigen knop of marge).
import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Card, T, Stack, Row } from './ui';
import { colors, space } from './theme';
import { parseBlocks } from './markdownLite';

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

function Node({ node }) {
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
    // confirm_action rendert pas in fase 3 (HITL-bevestigingskaart); tot die tijd
    // toont de samenvatting als tekst zodat er nooit stiekem iets uitvoerbaars staat.
    case 'confirm_action':
      return <T variant="body" color={colors.inkSoft}>{node.summary}</T>;
    default:
      return null;
  }
}

export function AssistantMessageView({ tree = [] }) {
  if (tree.length === 0) return null;
  return (
    <Stack gap={space.sm}>
      {tree.map((node, i) => <View key={i}><Node node={node} /></View>)}
    </Stack>
  );
}
