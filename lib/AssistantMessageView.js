// Renderer over de genormaliseerde assistent-catalog (lib/assistantUi.js).
// Tekent uitsluitend nodes die de pure poortwachter heeft goedgekeurd; kent per
// node-type één rustige weergave uit de bestaande bouwstenen (DESIGN.md: een
// scherm verzint geen eigen knop of marge).
import React from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Card, T, Stack, Row } from './ui';
import { colors, space } from './theme';

function Node({ node }) {
  switch (node.type) {
    case 'text':
      return <T variant="body">{node.text}</T>;
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
