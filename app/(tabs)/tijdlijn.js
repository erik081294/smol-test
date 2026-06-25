import React, { useMemo, useCallback } from 'react';
import { FlatList, View, Text, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTimeline, TIMELINE_BUCKET } from '../../lib/useTimeline';
import { useSignedUrl } from '../../lib/photoStorage';
import { relativeTime } from '../../lib/activity';
import { ScreenHeader, Card, Avatar, FAB, Empty, ListSkeleton } from '../../lib/ui';
import { colors, type, space, radius } from '../../lib/theme';
import { t } from '../../lib/i18n';

// Tijdlijn / prikbord (TML-1): handgeschreven berichten (tekst + grote foto's) als
// hoofdmoot. De samenvouwbare activiteit-laag eronder komt in TML-5.
const THUMB = 104;

function Thumb({ path, size = THUMB }) {
  const url = useSignedUrl(TIMELINE_BUCKET, path);
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" /> : null}
    </View>
  );
}

function PhotoStrip({ photos }) {
  if (!photos?.length) return null;
  const shown = photos.slice(0, 3);
  const extra = photos.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.sm }}>
      {shown.map((p) => <Thumb key={p.id} path={p.photo_path} />)}
      {extra > 0 ? (
        <View style={{ width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[type.h2, { color: colors.inkSoft }]}>{`+${extra}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PostCard({ post, author, onPress }) {
  const body = (post.body ?? '').trim();
  const name = author?.display_name ?? 'Lid';
  return (
    <Card onPress={onPress} accessibilityLabel={`${name}: ${body || t('widget.timeline.photo')}`} style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar emoji={author?.avatar_emoji} name={name} />
        <View style={{ flex: 1 }}>
          <Text style={type.title} numberOfLines={1}>{name}</Text>
          <Text style={type.caption}>{relativeTime(post.created_at)}</Text>
        </View>
      </View>
      {body ? <Text style={[type.body, { marginTop: space.sm }]} numberOfLines={6}>{body}</Text> : null}
      <PhotoStrip photos={post.photos} />
    </Card>
  );
}

export default function Tijdlijn() {
  const router = useRouter();
  const { posts, loading, reload, members } = useTimeline();
  const byId = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m])),
    [members],
  );

  // Herlaad bij focus (SWR): de tab is `freezeOnBlur`, dus terugkeren uit het detail
  // (bv. na verwijderen) remount niet — en een realtime DELETE draagt geen household_id,
  // dus de gefilterde subscriptie vangt 'm niet. Focus-reload houdt de feed vers.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('timeline.title')} subtitle={t('timeline.subtitle')} />
      <FlatList
        data={posts}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => (
          <PostCard post={item} author={byId[item.author_id]} onPress={() => router.push(`/tijdlijn/${item.id}`)} />
        )}
        ListEmptyComponent={loading ? (
          <ListSkeleton count={4} />
        ) : (
          <Empty
            illustration="groups"
            title={t('timeline.empty.title')}
            subtitle={t('timeline.empty.subtitle')}
            actionTitle={t('timeline.fab')}
            onAction={() => router.push('/tijdlijn/compose')}
          />
        )}
      />
      <FAB label={t('timeline.fab')} accessibilityLabel={t('timeline.compose.title')} onPress={() => router.push('/tijdlijn/compose')} />
    </SafeAreaView>
  );
}
