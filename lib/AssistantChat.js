// Herbruikbare chat-UI van de Huishoek Assistent (AI-10, "assistent overal"):
// gebruikt door het tab-scherm (app/(tabs)/assistent.js) én de overlay-sheet
// (lib/AssistantSheet.js) — één chatervaring, één gespreksstate (provider).
// De vorm-logica leeft in de pure lagen; dit is puur render + lokale invoerstate.
import React, { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { Field, IconButton, Chip, T, Stack, Row, Empty, Button, BottomSheet, SheetScrollView } from './ui';
import { AssistantMessageView, MarkdownText } from './AssistantMessageView';
import { toEditableItems, fromEditableItems, EDITABLE_FIELDS } from './assistantActions';
import { colors, space, radius } from './theme';
import { t } from './i18n';

const SUGGESTIONS = ['assistant.suggest.today', 'assistant.suggest.groceries', 'assistant.suggest.pantry', 'assistant.suggest.expenses'];

function Bubble({ item, onAction, onEdit }) {
  const mine = item.role === 'user';
  return (
    <View style={{
      // Gebruikersbeurt = compacte bubble rechts; assistent-beurt = volledige
      // breedte zonder bubble (device-feedback AI-15) zodat kaarten en tekst de
      // hele chatruimte krijgen.
      alignSelf: mine ? 'flex-end' : 'stretch',
      maxWidth: mine ? '88%' : '100%',
      backgroundColor: mine ? colors.forest : 'transparent',
      borderRadius: radius.lg,
      paddingHorizontal: mine ? space.md : 0,
      paddingVertical: mine ? space.sm : 0,
      marginBottom: space.sm,
    }}>
      {mine
        ? <T variant="body" color={colors.bg}>{item.text}</T>
        // De tree bevat de antwoordtekst al als text-node (buildTurnResult) —
        // item.text hier óók renderen zou 'm verdubbelen. Alleen als de tree leeg
        // is (een respons zonder nodes) valt 'ie terug op item.text i.p.v. een
        // blanco bubble te tonen.
        : item.tree.length > 0
          ? <AssistantMessageView tree={item.tree} onAction={onAction} onEdit={onEdit} />
          : item.text
            ? <MarkdownText text={item.text} />
            : null}
    </View>
  );
}

// Tussenstand van een streamende beurt (AI-5, ronde D): de tekst groeit mee met
// de delta's, in dezelfde vorm als de definitieve assistent-bubble.
function StreamingBubble({ stream }) {
  if (!stream?.text) return null;
  return (
    <View style={{ alignSelf: 'stretch', maxWidth: '100%', marginBottom: space.sm }}>
      <MarkdownText text={stream.text} />
    </View>
  );
}

// De edit-sheet (AI-10, mens↔AI-overdracht): de gebruiker neemt een pending
// voorstel over en bewerkt de velden zelf. Bewaren stuurt de bewerkte items
// door dezelfde propose()-validatie op de server (decision 'edit'); daarna kan
// hij gewoon weer verder chatten — de AI ziet de bewerking in zijn context.
function ProposalEditSheet({ edit, onClose, onSave }) {
  const [items, setItems] = useState(edit.items);
  const [busy, setBusy] = useState(false);
  const fields = EDITABLE_FIELDS[edit.tool] ?? [];

  const setField = (index, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [key]: value } : it)));
  };
  const save = async () => {
    setBusy(true);
    try {
      await onSave(items);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} avoidKeyboard>
      <SheetScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <Stack gap={space.md}>
          <T variant="label">{t('assistant.edit.sheetTitle')}</T>
          {items.map((it, i) => (
            <Stack key={i} gap={space.xs} style={{ borderLeftWidth: 2, borderLeftColor: colors.line, paddingLeft: space.sm }}>
              {fields.map((f) => (
                <Field
                  key={f.key}
                  label={t(f.labelKey)}
                  value={it[f.key] ?? ''}
                  onChangeText={(v) => setField(i, f.key, v)}
                  keyboardType={f.int ? 'number-pad' : 'default'}
                />
              ))}
            </Stack>
          ))}
          <Row gap={space.sm}>
            <Button title={t('assistant.edit.save')} onPress={save} loading={busy} fullWidth={false} style={{ flex: 1 }} />
            <Button title={t('assistant.edit.cancel')} variant="ghost" onPress={onClose} disabled={busy} fullWidth={false} style={{ flex: 1 }} />
          </Row>
        </Stack>
      </SheetScrollView>
    </BottomSheet>
  );
}

export function AssistantChat({ assistant, autoFocus = false }) {
  const { enabled, messages, busy, stream, send, stop, retry, canRetry, choices, resolveAction, loadProposal, memberNames } = assistant;
  const [draft, setDraft] = useState('');
  // { actionId, tool, items } | null — de openstaande edit-sessie.
  const [edit, setEdit] = useState(null);

  const submit = (text) => {
    const value = (text ?? draft).trim();
    if (!value) return;
    setDraft('');
    send(value);
  };

  // "Bewerken" op de bevestigingskaart → opgeslagen args ophalen (alleen de
  // eigenaar kan dat, RLS) en de edit-sheet openen met bewerkbare velden.
  const openEdit = async (actionId) => {
    const proposal = await loadProposal(actionId);
    if (!proposal) return;
    setEdit({
      actionId,
      tool: proposal.tool,
      // De opgeslagen (genormaliseerde) items: hieruit reizen de niet-bewerkbare
      // CARRY_FIELDS (ingrediënten, recipe_id) mee bij het bewaren.
      rawItems: Array.isArray(proposal.args?.items) ? proposal.args.items : [],
      items: toEditableItems(proposal.tool, proposal.args, memberNames ?? {}),
    });
  };

  const saveEdit = async (editedItems) => {
    const args = fromEditableItems(edit.tool, editedItems, edit.rawItems);
    await resolveAction(edit.actionId, 'edit', undefined, { args });
    setEdit(null);
  };

  return (
    <View style={{ flex: 1 }}>
      {messages.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.lg }}>
          <Empty emoji="💬" title={t('assistant.empty.title')} subtitle={t('assistant.empty.subtitle')} />
          <Row gap={space.xs} wrap style={{ justifyContent: 'center', marginTop: space.md }}>
            {SUGGESTIONS.map((key) => (
              <Chip key={key} label={t(key)} onPress={() => submit(t(key))} />
            ))}
          </Row>
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble item={item} onAction={resolveAction} onEdit={openEdit} />}
          // Inverted lijst: de header rendert onderaan — precies waar de
          // streamende (nieuwste) beurt hoort.
          ListHeaderComponent={<StreamingBubble stream={stream} />}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md }}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {busy ? (
        <T variant="caption" color={colors.inkSoft} style={{ paddingHorizontal: space.lg, paddingBottom: space.xs }}>
          {stream?.status || t('assistant.thinking')}
        </T>
      ) : null}
      {choices.length > 0 || canRetry ? (
        // Eén horizontaal-scrollende rij i.p.v. wrappen (AI-13-poets): de chips
        // pikken zo nooit meerdere regels verticale ruimte in van het gesprek.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.lg, paddingBottom: space.xs }}
        >
          {canRetry ? <Chip label={t('assistant.retry')} onPress={retry} testID="t-assistant-retry" /> : null}
          {choices.map((c) => <Chip key={c} label={c} onPress={() => submit(c)} />)}
        </ScrollView>
      ) : null}
      <Row gap={space.sm} style={{ paddingHorizontal: space.lg, paddingBottom: space.md, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder={t('assistant.placeholder')}
            editable={enabled && !busy}
            onSubmitEditing={() => submit()}
            returnKeyType="send"
            autoFocus={autoFocus}
            testID="t-assistant-input"
          />
        </View>
        {busy ? (
          // Stop-knop (ronde E): breekt de streamende beurt af, partial blijft staan.
          <IconButton icon="stop" accessibilityLabel={t('assistant.stop')} onPress={stop}
            testID="t-assistant-stop" />
        ) : (
          <IconButton icon="send" accessibilityLabel={t('assistant.send')} onPress={() => submit()}
            disabled={!enabled || draft.trim().length === 0} testID="t-assistant-send" />
        )}
      </Row>
      {edit ? <ProposalEditSheet edit={edit} onClose={() => setEdit(null)} onSave={saveEdit} /> : null}
    </View>
  );
}
