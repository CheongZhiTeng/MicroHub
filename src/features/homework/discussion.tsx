import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uuid } from 'expo';
import {
  Body,
  Button,
  Card,
  Heading,
  IconButton,
  Notice,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { useLanguage } from '../../locales/provider';
import { useTheme } from '../../theme/provider';
import { useSession } from '../session';
import { useBusy } from '../busy';
import { errorMessage } from '../../lib/validation';
import { homework, type Assignment } from './api';
import { useChatFeed } from './chat-feed';

export function Discussion({ a }: { a: Assignment }) {
  const { session } = useSession();
  return (
    session && (
      <DiscussionEntry
        key={a.id + session.user.id}
        a={a}
        user={session.user.id}
      />
    )
  );
}
function useComposer(id: string) {
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const token = useRef('');
  const { busy, start, finish } = useBusy();
  function edit(value: string) {
    token.current = '';
    setSendError('');
    setDraft(value);
  }
  async function post() {
    if (!draft.trim() || !start()) return false;
    setSendError('');
    token.current ||= uuid.v4();
    try {
      await homework('hw_comment', {
        p_id: id,
        p_text: draft,
        p_request: token.current,
      });
      edit('');
      return true;
    } catch (e) {
      setSendError(errorMessage(e));
      return false;
    } finally {
      finish();
    }
  }
  return { draft, edit, post, sending: busy, sendError };
}
function DiscussionEntry({ a, user }: { a: Assignment; user: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const composer = useComposer(a.id);
  const close = () => setOpen(false);
  return (
    <Card>
      <Heading>{t('Class discussion')}</Heading>
      <Body>{t('Messages here are visible to assignment participants.')}</Body>
      <Button
        title={t('Open discussion')}
        icon="chat"
        variant="secondary"
        onPress={() => setOpen(true)}
      />
      {open && (
        <Modal visible animationType="none" onRequestClose={close}>
          <Conversation a={a} user={user} composer={composer} close={close} />
        </Modal>
      )}
    </Card>
  );
}
function Conversation({
  a,
  user,
  composer,
  close,
}: {
  a: Assignment;
  user: string;
  composer: ReturnType<typeof useComposer>;
  close: () => void;
}) {
  const { draft, edit, post, sending, sendError } = composer;
  const { t, dayLabel, timeLabel } = useLanguage();
  const {
    theme: { color },
  } = useTheme();
  const { rows, earlier, loading, error, refresh } = useChatFeed(a.id);
  const [unseen, setUnseen] = useState(false);
  const list = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewport = useRef({ offset: 0, height: 0 });
  const nearBottom = useRef(true);
  const anchor = useRef<{ offset: number; height: number } | null>(null);
  const lastSeen = useRef<string | undefined>(undefined);
  const newest = rows.at(-1)?.id;
  useEffect(() => {
    if (
      newest &&
      lastSeen.current &&
      newest !== lastSeen.current &&
      !nearBottom.current
    )
      setUnseen(true);
    lastSeen.current = newest;
  }, [newest]);
  async function send() {
    if (await post()) {
      nearBottom.current = true;
      setUnseen(false);
      await refresh();
    }
  }
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: color.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <View
          style={[
            styles.panel,
            { backgroundColor: color.background, borderColor: color.border },
          ]}
        >
          <View
            style={[
              styles.header,
              { backgroundColor: color.surface, borderColor: color.border },
            ]}
          >
            <IconButton
              icon="back"
              label={t('Close discussion')}
              onPress={close}
            />
            <View style={styles.fill}>
              <Heading>{t('Class discussion')}</Heading>
              <Text numberOfLines={2} style={{ color: color.muted }}>
                {a.title}
              </Text>
            </View>
          </View>
          {error && (
            <View>
              <Notice error text={error} />
              <Button title={t('Retry')} onPress={() => void refresh()} />
            </View>
          )}
          <ScrollView
            ref={list}
            style={styles.fill}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={({ nativeEvent: e }) => {
              viewport.current.offset = e.contentOffset.y;
              nearBottom.current =
                e.contentSize.height -
                  e.layoutMeasurement.height -
                  e.contentOffset.y <
                80;
              if (nearBottom.current) setUnseen(false);
            }}
            onLayout={() => {
              if (nearBottom.current)
                list.current?.scrollToEnd({ animated: false });
            }}
            onContentSizeChange={(_, h) => {
              viewport.current.height = h;
              if (anchor.current) {
                list.current?.scrollTo({
                  y: anchor.current.offset + h - anchor.current.height,
                  animated: false,
                });
                anchor.current = null;
              } else if (nearBottom.current)
                list.current?.scrollToEnd({ animated: false });
            }}
          >
            {earlier && (
              <Button
                title={t('Earlier messages')}
                variant="ghost"
                disabled={loading}
                onPress={async () => {
                  anchor.current = { ...viewport.current };
                  if (!(await refresh(true))) anchor.current = null;
                }}
              />
            )}
            {!rows.length &&
              (loading ? (
                <ActivityIndicator color={color.primary} />
              ) : (
                !error && <Body>{t('No discussion yet.')}</Body>
              ))}
            {rows.map((m, i) => {
              const own = m.author === user;
              const day = dayLabel(m.created_at);
              const prev = rows[i - 1];
              const newDay = !prev || day !== dayLabel(prev.created_at);
              const first = newDay || prev?.author !== m.author;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <Text
                      style={[
                        styles.date,
                        { color: color.muted, backgroundColor: color.surface },
                      ]}
                    >
                      {day}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      {
                        marginTop: first ? 8 : 2,
                        alignSelf: own ? 'flex-end' : 'flex-start',
                        backgroundColor: own ? color.selected : color.surface,
                        borderColor: own ? color.selected : color.border,
                        borderBottomRightRadius: own ? 4 : 17,
                        borderBottomLeftRadius: own ? 17 : 4,
                      },
                    ]}
                  >
                    {first && !own && (
                      <Text
                        style={[styles.sender, { color: color.primaryDark }]}
                      >
                        {m.author_name}
                      </Text>
                    )}
                    <Text
                      selectable
                      style={[styles.body, { color: color.text }]}
                    >
                      {m.body}
                    </Text>
                    <Text style={[styles.clock, { color: color.muted }]}>
                      {timeLabel(m.created_at)}
                    </Text>
                  </View>
                </Fragment>
              );
            })}
          </ScrollView>
          {unseen && (
            <Button
              title={t('New messages')}
              variant="secondary"
              onPress={() => {
                nearBottom.current = true;
                setUnseen(false);
                list.current?.scrollToEnd({ animated: false });
              }}
            />
          )}
          {sendError && <Notice error text={sendError} />}
          {a.lifecycle === 'archived' ? (
            <Body>{t('This discussion is read-only.')}</Body>
          ) : (
            <View
              style={[
                styles.composer,
                { borderColor: color.border, backgroundColor: color.surface },
              ]}
            >
              <TextInput
                accessibilityLabel={t('Message to class')}
                placeholder={t('Message to class')}
                placeholderTextColor={color.muted}
                multiline
                value={draft}
                onChangeText={edit}
                maxLength={3000}
                editable={!sending}
                style={[
                  styles.input,
                  {
                    color: color.text,
                    backgroundColor: color.background,
                    borderColor: color.border,
                  },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Post message')}
                accessibilityState={{ disabled: sending || !draft.trim() }}
                disabled={sending || !draft.trim()}
                onPress={() => void send()}
                style={[
                  styles.send,
                  {
                    backgroundColor: draft.trim()
                      ? color.primary
                      : color.background,
                  },
                ]}
              >
                {sending ? (
                  <ActivityIndicator color={color.onPrimary} />
                ) : (
                  <Icon
                    name="send"
                    color={draft.trim() ? color.onPrimary : color.muted}
                  />
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  panel: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
  },
  thread: { paddingHorizontal: 16, paddingVertical: 12 },
  date: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginVertical: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '85%',
    minWidth: 72,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  body: { fontSize: 16, lineHeight: 23 },
  sender: { fontSize: 13, fontWeight: '700' },
  clock: { fontSize: 12, alignSelf: 'flex-end', marginTop: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 108,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 20,
  },
  send: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
});
