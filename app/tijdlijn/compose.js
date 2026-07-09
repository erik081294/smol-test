import React, { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTimeline } from '../../lib/useTimeline';
import { useHousehold } from '../../lib/household';
import { pickImageAsset } from '../../lib/photoPicker';
import { isPostValid } from '../../lib/timeline';
import { Editor, Field, Button } from '../../lib/ui';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { colors, type, space, radius, font } from '../../lib/theme';
import { dialog } from '../../lib/dialog';
import { t } from '../../lib/i18n';

// Nieuw tijdlijn-bericht (TML-1): tekst en/of meerdere foto's + zichtbaarheid.
// Foto's worden één voor één toegevoegd (hergebruikt de gedeelde picker, die al
// downscalet); valideren op tekst-óf-foto via de pure isPostValid.
//
// Het Editor-omhulsel borgt drie conventies in één keer: de vaste kop met "Plaatsen"
// rechtsboven, de dirty-guard (per ongeluk sluiten met getypte tekst vraagt eerst om
// bevestiging — UX-6, óók de Android hardware-back), en het toetsenbord-ontwijken.
export default function Compose() {
  const router = useRouter();
  const { addPost } = useTimeline();
  const { members, subgroups } = useHousehold();
  const [body, setBody] = useState('');
  const [assets, setAssets] = useState([]);
  const [visibility, setVisibility] = useState('household');
  const [shareSubgroupId, setShareSubgroupId] = useState(null);
  const [shareWith, setShareWith] = useState([]);
  const [busy, setBusy] = useState(false);

  const addPhoto = async () => {
    const a = await pickImageAsset(false); // bibliotheek
    if (a) setAssets((prev) => [...prev, a]);
  };
  const removePhoto = (i) => setAssets((prev) => prev.filter((_, idx) => idx !== i));
  const toggleMember = (p) =>
    setShareWith((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const canPost = isPostValid({ body, photoCount: assets.length });
  // "Vies" = er is iets in te leveren bij sluiten; triggert de discard-bevestiging.
  const dirty = body.trim().length > 0 || assets.length > 0;

  const submit = async () => {
    if (!canPost || busy) return;
    setBusy(true);
    try {
      await addPost({ body, assets, visibility, shareSubgroupId, shareWith });
      router.back();
    } catch (e) {
      dialog.alert({ title: t('timeline.compose.title'), body: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Editor
      title={t('timeline.compose.title')}
      onClose={() => router.back()}
      onConfirm={submit}
      confirmLabel={t('timeline.compose.post')}
      confirmDisabled={!canPost}
      busy={busy}
      dirty={dirty}
    >
      <Field
        placeholder={t('timeline.compose.placeholder')}
        value={body}
        onChangeText={setBody}
        multiline
        style={{ minHeight: 96 }}
      />

      {assets.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
          {assets.map((a, i) => (
            <View key={`${a.uri}-${i}`} style={{ width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden' }}>
              <Image source={{ uri: a.uri }} style={{ width: 96, height: 96 }} resizeMode="cover" />
              <Pressable
                onPress={() => removePhoto(i)}
                accessibilityRole="button"
                accessibilityLabel={t('common.remove')}
                hitSlop={8}
                style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.onDark, fontFamily: font.semi }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: space.md }}>
        <Button title={t('timeline.compose.addPhoto')} icon="photo" variant="soft" onPress={addPhoto} />
      </View>

      <View style={{ marginTop: space.lg }}>
        <VisibilityPicker
          collapsible
          visibility={visibility}
          onChangeVisibility={setVisibility}
          shareSubgroupId={shareSubgroupId}
          onChangeSubgroup={setShareSubgroupId}
          shareWith={shareWith}
          onToggleMember={toggleMember}
          subgroups={subgroups}
          members={members}
        />
      </View>

      {!canPost ? (
        <Text style={[type.caption, { color: colors.inkFaint, marginTop: space.md }]}>{t('timeline.compose.empty')}</Text>
      ) : null}
    </Editor>
  );
}
