import React, { useMemo, useCallback } from 'react';
import { FlatList, View, Text, Image, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTimeline, TIMELINE_BUCKET } from '../../lib/useTimeline';
import { useReactions } from '../../lib/useReactions';
import { useComments } from '../../lib/useComments';
import { useActivity } from '../../lib/useActivity';
import { useTimelineFilters } from '../../lib/useTimelineFilters';
import { visibleOnTimeline, moduleForEventType } from '../../lib/timelineFilter';
import { useSignedUrl } from '../../lib/photoStorage';
import { relativeTime } from '../../lib/activity';
import { commentCountLabel } from '../../lib/timeline';
import { ScreenHeader, Card, Avatar, FAB, Empty, ModuleHelpButton, ListSkeleton, Collapsible, Banner, IconButton, Row } from '../../lib/ui';
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

// Read-only reactie-samenvatting op de feed-kaart: opgetelde emoji-chips (jouw eigen
// reactie licht op). Bewust niet-interactief hier — togglen gebeurt op het detail-scherm,
// zodat de kaart-Pressable (die naar detail navigeert) niet botst met chip-taps.
function ReactionSummary({ reactions }) {
  if (!reactions?.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
      {reactions.map((r) => (
        <View key={r.emoji} style={{
          flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 2,
          borderRadius: radius.md, backgroundColor: r.mine ? colors.forestTint : colors.surfaceAlt,
        }}>
          <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
          <Text style={[type.caption, { color: r.mine ? colors.brandText : colors.inkSoft }]}>{r.count}</Text>
        </View>
      ))}
    </View>
  );
}

function PostCard({ post, author, reactions, commentCount = 0, onPress }) {
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
      <ReactionSummary reactions={reactions} />
      {/* Comment-teller (TML-4): het gesprek zelf leeft op het detail-scherm. */}
      {commentCount > 0 ? (
        <Text style={[type.caption, { marginTop: space.sm }]}>{commentCountLabel(commentCount)}</Text>
      ) : null}
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
  const { posts, loading, error, reload, loadMore, hasMore, members } = useTimeline();
  const { reactionsFor } = useReactions();
  const { commentCountFor } = useComments();
  const { feed: activity } = useActivity();
  // Tijdlijn-filter (TML-6): de twee prefs-lagen bepalen welke systeem-events de
  // activiteit-laag toont — puur beslist door visibleOnTimeline (module + event-type).
  const { householdDisabled, userDisabled } = useTimelineFilters();
  const visibleActivity = useMemo(
    () => activity.filter((a) => visibleOnTimeline(
      { module: moduleForEventType(a.type), eventType: a.type },
      { householdDisabled, userDisabled },
    )),
    [activity, householdDisabled, userDisabled],
  );
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
        right={
          <Row gap={space.xs}>
            {/* Filterinstellingen (TML-6): wat verschijnt er op de tijdlijn? */}
            <IconButton icon="filter" accessibilityLabel={t('timeline.filters.open')}
              onPress={() => router.push('/tijdlijn/filters')} />
            <ModuleHelpButton module="tijdlijn" />
          </Row>
        } />
      {/* Foutstaat (UX-23): een mislukte (her)laadbeurt toont een nette banner met
          opnieuw-proberen i.p.v. een stille lege lijst. */}
      {error && !loading ? (
        <View style={{ paddingHorizontal: space.lg, marginTop: space.sm }}>
          <Banner tone="warning" icon="warning" title={t('common.loadError')}>
            <Pressable onPress={reload} accessibilityRole="button" hitSlop={6}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: space.xs })}>
              <Text style={[type.label, { color: colors.forest }]}>{t('common.retry')}</Text>
            </Pressable>
          </Banner>
        </View>
      ) : null}
      <FlatList
        data={posts}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <PostCard post={item} author={byId[item.author_id]} reactions={reactionsFor('post', item.id)}
            commentCount={commentCountFor(item.id)} onPress={() => router.push(`/tijdlijn/${item.id}`)} />
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
        ListFooterComponent={visibleActivity.length ? (
          <Collapsible label={t('timeline.activity')} summary={t('timeline.activity.summary')} style={{ marginTop: space.md }}>
            {visibleActivity.map((a) => <ActivityRow key={a.id} item={a} />)}
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
