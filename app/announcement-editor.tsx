import { useReach, initialScope, publishLabel } from '../src/features/daily';
import { useLocalSearchParams, router } from 'expo-router';
import { uuid } from 'expo';
import { useRef, useState } from 'react';
import {
  Body,
  Button,
  Card,
  Field,
  Notice,
  Screen,
} from '../src/components/ui';
import { useFormExit } from '../src/features/form-exit';
import { Access } from '../src/features/access';
import {
  publishAnnouncement,
  useAnnouncements,
} from '../src/features/announcements';
import { useBusy } from '../src/features/busy';

import { Choices, FetchState } from '../src/features/homework/controls';
import { errorMessage } from '../src/lib/validation';
import { useLanguage } from '../src/locales/provider';

function Compose({
  audiences,
  onPublished,
  onCancel,
}: {
  audiences: [string, string][];
  onPublished: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const { scope } = useLocalSearchParams();
  const initial = initialScope(
    scope,
    audiences.some(([id]) => id === 'big'),
    audiences.map(([id]) => ({ id })),
  );
  const [audience, setAudience] = useState(initial);
  const reach = useReach(audience);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const { busy, start, finish } = useBusy();
  const request = useRef<{ content: string; id: string } | null>(null);
  const exit = useFormExit(!!title || !!body || audience !== initial);
  const selected = audiences.find(([id]) => id === audience);
  async function publish() {
    if (!selected || !title.trim() || !body.trim() || !start()) return;
    setError('');
    const content = JSON.stringify([audience, title.trim(), body.trim()]);
    if (request.current?.content !== content)
      request.current = { content, id: uuid.v4() };
    try {
      await publishAnnouncement(
        request.current.id,
        audience === 'big' ? '' : audience,
        title.trim(),
        body.trim(),
        reach.data,
      );
      exit.finish();
      onPublished();
    } catch (error) {
      setError(errorMessage(error));
      void reach.refresh();
    } finally {
      finish();
    }
  }
  return (
    <Card>
      {exit.dialog}
      {reach.error && (
        <>
          <Notice error text={t(reach.error)} />
          <Button title={t('Retry')} onPress={reach.refresh} />
        </>
      )}

      <Body>{t('Recipients')}</Body>
      <Choices
        items={audiences}
        value={audience}
        onChange={setAudience}
        disabled={confirm}
      />
      {selected && typeof reach.data === 'number' && (
        <Body>
          {selected[1]} · {reach.data}
          {t(reach.data === 1 ? ' person' : ' people')}
        </Body>
      )}
      <Field
        label={t('Title')}
        value={title}
        onChangeText={setTitle}
        maxLength={160}
        editable={!confirm}
      />
      <Field
        label={t('Announcement message')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={10000}
        editable={!confirm}
      />
      {!!error && <Notice error text={t(error)} />}
      {confirm ? (
        <>
          <Notice
            text={t('Publish this announcement to {audience}?').replace(
              '{audience}',
              selected?.[1] ?? '',
            )}
          />
          <Button
            title={
              typeof reach.data === 'number'
                ? publishLabel(t, selected?.[1] ?? '', reach.data)
                : t('Publish announcement')
            }
            busy={busy}
            disabled={!selected || reach.data === undefined}
            onPress={() => void publish()}
          />
          <Button
            title={t('Continue editing')}
            disabled={busy}
            variant="ghost"
            onPress={() => {
              setConfirm(false);
              setError('');
            }}
          />
        </>
      ) : (
        <>
          <Button
            title={t('Review announcement')}
            disabled={!selected || !title.trim() || !body.trim()}
            onPress={() => setConfirm(true)}
          />
          <Button title={t('Cancel')} variant="ghost" onPress={onCancel} />
        </>
      )}
    </Card>
  );
}

function Editor() {
  const { t } = useLanguage();
  const feed = useAnnouncements();
  if (!feed.data) return <FetchState error={feed.error} retry={feed.refresh} />;
  const audiences: [string, string][] = feed.data.groups.map((g) => [
    g.id,
    g.name,
  ]);
  if (feed.data.can_publish_club) audiences.unshift(['big', t('Big class')]);
  if (!audiences.length)
    return <Notice error text={t('Active teach access required')} />;
  return (
    <Compose
      audiences={audiences}
      onPublished={() => router.replace('/announcements')}
      onCancel={() =>
        router.canGoBack() ? router.back() : router.replace('/announcements')
      }
    />
  );
}
export default function AnnouncementEditor() {
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const { t } = useLanguage();
  return (
    <Screen title={t('New announcement')}>
      <Access member signInParams={{ next: 'announcement-editor', scope }}>
        {(user) => <Editor key={user.profile.id} />}
      </Access>
    </Screen>
  );
}
