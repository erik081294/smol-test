import React from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { BottomSheet, ModalHeader, SheetScrollView, Field, Button, Row } from './ui';
import { colors, radius, type, space } from './theme';
import { t } from './i18n';

// Gedeelde foto-/tijdlijn-detail-sheet. De plant- en huisdier-detailschermen hadden hier
// elk een vrijwel identieke BottomSheet (optionele foto + datum + notitie + opslaan/
// verwijderen); dit is de gedeelde schil. De domein-verschillen blijven bewust bij de
// caller via props — gedragsneutraal:
//   • title       — de caller bepaalt de kop (plant: foto/notitie; huisdier: foto/gewicht/
//                    notitie);
//   • dateText    — de datumregel, incl. een eventueel domein-suffix (bv. een gewicht);
//   • onRemove    — de caller kiest of verwijderen éérst bevestigt (plant via dialog) of
//                    direct gebeurt (huisdier);
//   • saveLabel / noteLabel / notePlaceholder — per-domein i18n-sleutels.
// `imageUrl` is null zolang de signed URL nog laadt → dan tonen we een spinner.
export function PhotoDetailSheet({
  visible, onClose, title, hasPhoto, imageUrl, dateText,
  noteValue, onChangeNote, noteLabel, notePlaceholder,
  saveLabel, onSave, onRemove,
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard>
      <ModalHeader title={title} onClose={onClose} />
      <SheetScrollView contentContainerStyle={{ paddingHorizontal: 18 }} keyboardShouldPersistTaps="handled">
        {hasPhoto ? (
          <View style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden',
            backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            {imageUrl
              ? <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              : <ActivityIndicator color={colors.forest} />}
          </View>
        ) : null}
        {dateText ? <Text style={[type.caption, { marginTop: 8 }]}>{dateText}</Text> : null}
        <View style={{ marginTop: space.md }}>
          <Field label={noteLabel} value={noteValue} onChangeText={onChangeNote} multiline
            placeholder={notePlaceholder} style={{ marginBottom: 0 }} />
        </View>
        <Row gap={space.sm} style={{ marginTop: space.md }}>
          <View style={{ flex: 1 }}><Button title={t('common.remove')} icon="delete" variant="ghost" onPress={onRemove} /></View>
          <View style={{ flex: 1 }}><Button title={saveLabel} onPress={onSave} /></View>
        </Row>
      </SheetScrollView>
    </BottomSheet>
  );
}
