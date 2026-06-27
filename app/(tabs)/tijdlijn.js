import React, { useMemo, useCallback } from 'react';
import { FlatList, View, Text, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTimeline, TIMELINE_BUCKET } from '../../lib/useTimeline';
import { useActivity } from '../../lib/useActivity';
import { useSignedUrl } from '../../lib/photoStorage';
import { relativeTime } from '../../lib/activity';
import { ScreenHeader, Card, Avatar, FAB, Empty, ModuleHelpButton, ListSkeleton, Collapsible } from '../../lib/ui';
import { Icon } from '../../lib/icons';
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
  const pinned = post.pinned_at != null;
  return (
    <Card onPress={onPress} accessibilityLabel={`${pinned ? `${t('timeline.pinned')}. ` : ''}${name}: ${body || t('widget.timeline.photo')}`} style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar emoji={author?.avatar_emoji} name={name} />
        <View style={{ flex: 1 }}>
          <Text style={type.title} numberOfLines={1}>{name}</Text>
          <Text style={type.caption}>{relativeTime(post.created_at)}</Text>
        </View>
        {/* Gepind-indicator (TML-2): klein pin-icoon rechtsboven op de kaart. */}
        {pinned ? <Icon name="pinboard" size={16} color={colors.forest} /> : null}
      </View>
      {body ? <Text style={[type.body, { marginTop: space.sm }]} numberOfLines={6}>{body}</Text> : null}
      <PhotoStrip photos={post.photos} />
    </Card>
  );
}

// Eén regel in de samenvouwbare "Activiteit"-laag (TML-5): systeem-events (taak afgevinkt,
// uitgave/boodschap toegevoegd) als rustige caption-rij met icoon + relatieve tijd.
function ActivityRow({ item }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={item.icon} size={15} color={colors.inkSoft} />
      </View>
      <Text style={[type.caption, { flex: 1, color: colors.ink }]} numberOfLines={2}>{item.text}</Text>
      <Text style={[type.caption, { color: colors.inkFaint }]}>{item.when}</Text>
    </View>
  );
}

export default function Tijdlijn() {
  const router = useRouter();
  const { posts, loading, reload, loadMore, hasMore, members } = useTimeline();
  const { feed: activity } = useActivity();
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
      <ScreenHeader title={t('timeline.title')} subtitle={t('timeline.subtitle')}
        right={<ModuleHelpButton module="tijdlijn" />} />
      <FlatList
        data={posts}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
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
        ListFooterComponent={activity.length ? (
          <Collapsible label={t('timeline.activity')} summary={t('timeline.activity.summary')} style={{ marginTop: space.md }}>
            {activity.map((a) => <ActivityRow key={a.id} item={a} />)}
          </Collapsible>
        ) : null}
      />
      {/* Lege-staat dedupe (DESIGN.md principe 4): de Empty-CTA draagt de primaire
          actie bij een leeg prikbord; de FAB komt pas terug zodra er berichten zijn. */}
      {posts.length > 0 ? (
        <FAB label={t('timeline.fab')} accessibilityLabel={t('timeline.compose.title')} onPress={() => router.push('/tijdlijn/compose')} />
      ) : null}
    </SafeAreaView>
  );
}
