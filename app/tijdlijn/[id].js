import React from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTimeline, TIMELINE_BUCKET } from '../../lib/useTimeline';
import { useSignedUrl } from '../../lib/photoStorage';
import { relativeTime } from '../../lib/activity';
import { ModalHeader, Avatar, Button, Empty, ListSkeleton } from '../../lib/ui';
import { colors, type, space, radius } from '../../lib/theme';
import { dialog } from '../../lib/dialog';
import { t } from '../../lib/i18n';

// Bericht-detail (TML-1): de post groot met de volledige foto-galerij + verwijderen.
// Reacties/comments komen in TML-3/TML-4. We lezen de post uit de al-geladen feed
// (de gebruiker komt vanuit de tijdlijn); deep-link toont een skeleton tot het laadt.
function BigPhoto({ path }) {
  const url = useSignedUrl(TIMELINE_BUCKET, path);
  return (
    <View style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt, marginTop: space.md }}>
      {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
    </View>
  );
}

export default function PostDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { posts, loading, deletePost, members } = useTimeline();
  const post = posts.find((p) => p.id === id);
  const author = post ? (members ?? []).find((m) => m.id === post.author_id) : null;

  const onDelete = async () => {
    const ok = await dialog.confirm({ title: t('timeline.deleteConfirm'), confirmLabel: t('common.delete'), tone: 'danger' });
    if (!ok) return;
    await deletePost(id);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={t('timeline.title')} onClose={() => router.back()} backLabel={t('timeline.title')} />
      {!post ? (
        loading ? <ListSkeleton count={3} /> : <Empty illustration="groups" title={t('timeline.empty.title')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Avatar emoji={author?.avatar_emoji} name={author?.display_name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={type.title}>{author?.display_name ?? 'Lid'}</Text>
              <Text style={type.caption}>{relativeTime(post.created_at)}</Text>
            </View>
          </View>
          {post.body ? <Text style={[type.body, { marginTop: space.md }]}>{post.body}</Text> : null}
          {(post.photos ?? []).map((ph) => <BigPhoto key={ph.id} path={ph.photo_path} />)}
          <View style={{ marginTop: space.xl }}>
            <Button title={t('timeline.delete')} icon="delete" variant="ghost" onPress={onDelete} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
