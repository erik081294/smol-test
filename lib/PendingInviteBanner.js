import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { Button } from './ui';
import { Icon } from './icons';
import { colors, type, space, radius } from './theme';
import { t } from './i18n';

// Melding "je bent uitgenodigd" (PLT-7). Verschijnt ná inloggen zodra er een geldig,
// opgeslagen pending-invite-token is — zo overleeft de uitnodiging de login-round-trip
// (incl. e-mailbevestiging), ook cross-device. Self-healing: een verlopen/ingetrokken/
// al-geaccepteerd token wordt opgeruimd en de banner verdwijnt. Tikken → het join-scherm,
// dé plek voor preview/accept/download-prompt.
export function PendingInviteBanner({ style }) {
  const { user } = useAuth();
  const { pendingInvite, peekInvite, clearPendingInvite } = useHousehold();
  const router = useRouter();
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user || !pendingInvite) { setPreview(null); return; }
    peekInvite(pendingInvite)
      .then((p) => {
        if (!active) return;
        if (p && p.status === 'valid') setPreview(p);
        else { setPreview(null); clearPendingInvite(); } // stale → opruimen
      })
      .catch(() => { if (active) setPreview(null); });
    return () => { active = false; };
  }, [user, pendingInvite]);

  if (!preview) return null;
  const household = `${preview.household_emoji} ${preview.household_name}`;
  return (
    <View style={[{ backgroundColor: colors.forest, borderRadius: radius.md, padding: space.lg, marginBottom: space.lg }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Icon name="home" size={20} color={colors.ocher} weight="fill" />
        <Text style={{ color: colors.onDark, fontWeight: '800', marginLeft: space.sm, fontSize: 15 }}>
          {t('invite.banner.title')}
        </Text>
      </View>
      <Text style={{ color: colors.ocherSoft, marginBottom: space.md, lineHeight: 20 }}>
        {t('invite.banner.body', { inviter: preview.inviter_name, household })}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Button title={t('invite.banner.view')} variant="accent" style={{ flex: 1 }}
          onPress={() => router.push(`/join/${pendingInvite}`)} />
        <Pressable onPress={clearPendingInvite} accessibilityRole="button"
          style={{ paddingHorizontal: space.md, paddingVertical: space.sm }}>
          <Text style={{ color: colors.ocherSoft, fontWeight: '600' }}>{t('invite.banner.dismiss')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
