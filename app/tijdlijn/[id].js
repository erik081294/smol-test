import React, { useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTimeline, TIMELINE_BUCKET } from '../../lib/useTimeline';
import { useReactions } from '../../lib/useReactions';
import { useComments } from '../../lib/useComments';
import { useSignedUrl } from '../../lib/photoStorage';
import { relativeTime } from '../../lib/activity';
import { ModalHeader, Avatar, Button, Empty, ListSkeleton, ReactionBar, SectionHeader, Field, IconButton } from '../../lib/ui';
import { colors, type, space, radius } from '../../lib/theme';
import { dialog } from '../../lib/dialog';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
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

// Eén regel in de comment-thread (TML-4): avatar + naam + relatieve tijd + tekst;
// je eigen comment krijgt een verwijderknop (RLS staat toch alleen je eigen rij toe).
function CommentRow({ comment, author, mine, onDelete }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
      <Avatar emoji={author?.avatar_emoji} name={author?.display_name} size={32} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={type.label}>{author?.display_name ?? 'Lid'}</Text>
          <Text style={type.caption}>{relativeTime(comment.created_at)}</Text>
        </View>
        <Text style={type.body}>{comment.body}</Text>
      </View>
      {mine ? (
        <IconButton icon="delete" size={18} tint={colors.inkFaint}
          accessibilityLabel={t('timeline.comments.delete')} onPress={onDelete} />
      ) : null}
    </View>
  );
}

export default function PostDetail() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams();
  const { posts, loading, deletePost, setPinned, members } = useTimeline();
  const { reactionsFor, toggle } = useReactions();
  const { commentsFor, addComment, deleteComment, viewerId } = useComments();
  const post = posts.find((p) => p.id === id);
  const pinned = post?.pinned_at != null;
  const author = post ? (members ?? []).find((m) => m.id === post.author_id) : null;
  const comments = commentsFor(id);
  const memberById = (pid) => (members ?? []).find((m) => m.id === pid);

  // Invoerveld voor een nieuwe comment (TML-4). Optimistisch via de hook; de fout-
  // dialoog is het vangnet (de thread rolt dan terug).
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try { await addComment(id, body); setDraft(''); }
    catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
    finally { setSending(false); }
  };

  // Verwijderen met ongedaan-maken (zelfde patroon als de uitgaven-editor): het bericht
  // verdwijnt meteen uit de feed (markPending), we keren terug, en de echte delete —
  // inclusief het opruimen van de foto's in de bucket — volgt pas als de toast verloopt.
  // Geen blokkerende Alert: undo is het vangnet en werkt óók op web (DESIGN.md principe 7).
  const onDelete = () => {
    markPending(id);
    router.back();
    toast.show({
      message: t('timeline.deleted'),
      actionLabel: t('common.undo'),
      onAction: () => unmarkPending(id),
      onExpire: async () => {
        try { await deletePost(id); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { unmarkPending(id); }
      },
    });
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
              <Text style={type.caption}>{relativeTime(post.created_at)}{pinned ? ` · ${t('timeline.pinned')}` : ''}</Text>
            </View>
          </View>
          {post.body ? <Text style={[type.body, { marginTop: space.md }]}>{post.body}</Text> : null}
          {(post.photos ?? []).map((ph) => <BigPhoto key={ph.id} path={ph.photo_path} />)}
          {/* Emoji-reacties (TML-3): teller-chips + picker onder het bericht. */}
          <ReactionBar
            reactions={reactionsFor('post', id)}
            onToggle={(emoji) => toggle('post', id, emoji).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }))}
            style={{ marginTop: space.lg }}
          />
          {/* Tekstreacties (TML-4): thread (oudste eerst) + invoerveld. Alléén op
              berichten — systeem-events tonen bewust geen comment-affordance. */}
          <View style={{ marginTop: space.lg }}>
            <SectionHeader title={t('timeline.comments.title')} count={comments.length} />
            {comments.length === 0 ? (
              <Text style={[type.caption, { marginTop: space.xs }]}>{t('timeline.comments.empty')}</Text>
            ) : comments.map((c) => (
              <CommentRow key={c.id} comment={c} author={memberById(c.author_id)} mine={c.author_id === viewerId}
                onDelete={() => deleteComment(c.id).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }))} />
            ))}
            <Field
              placeholder={t('timeline.comments.placeholder')}
              value={draft} onChangeText={setDraft}
              multiline maxLength={2000}
              accessibilityLabel={t('timeline.comments.placeholder')}
              style={{ marginTop: space.md, marginBottom: 0 }}
            />
            <Button title={t('timeline.comments.send')} icon="send" variant="soft"
              disabled={!draft.trim()} loading={sending} onPress={send}
              style={{ marginTop: space.sm }} />
          </View>
          <View style={{ marginTop: space.xl, gap: space.sm }}>
            {/* Pin/ontpin (TML-2): gepinde berichten staan bovenaan de feed. */}
            <Button title={pinned ? t('timeline.unpin') : t('timeline.pin')} icon="pinboard" variant="soft"
              onPress={() => setPinned(id, !pinned).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }))} />
            <Button title={t('timeline.delete')} icon="delete" variant="ghost" onPress={onDelete} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
