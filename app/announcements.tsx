import { router } from 'expo-router';
import { uuid } from 'expo';
import { useRef, useState } from 'react';
import {
  Badge,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Notice,
  Screen,
  SectionTitle,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import {
  announcementsPageSize,
  publishAnnouncement,
  useAnnouncements,
} from '../src/features/announcements';
import { useBusy } from '../src/features/busy';
import { dueLabel } from '../src/features/homework/api';
import { Choices, FetchState, Paging } from '../src/features/homework/controls';
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
  const [audience, setAudience] = useState(audiences[0]![0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const { busy, start, finish } = useBusy();
  const request = useRef<{ content: string; id: string } | null>(null);
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
        audience,
        title.trim(),
        body.trim(),
      );
      onPublished();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      finish();
    }
  }
  return (
    <Card>
      <SectionTitle icon="announcement">{t('New announcement')}</SectionTitle>
      <Body>{t('Recipients')}</Body>
      <Choices
        items={audiences}
        value={audience}
        onChange={setAudience}
        disabled={confirm}
      />
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
      {!!error && <Notice error text={error} />}
      {confirm ? (
        <>
          <Notice
            text={t('Publish this announcement to {audience}?').replace(
              '{audience}',
              selected?.[1] ?? '',
            )}
          />
          <Button
            title={t('Publish announcement')}
            busy={busy}
            disabled={!selected}
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
function Feed() {
  const { t } = useLanguage();
  const [page, setPage] = useState(0);
  const [compose, setCompose] = useState(false);
  const [published, setPublished] = useState(false);
  const feed = useAnnouncements(page);
  if (!feed.data) return <FetchState error={feed.error} retry={feed.refresh} />;
  const { items, groups, can_publish_club } = feed.data;
  const audiences: [string, string][] = groups.map(({ id, name }) => [
    id,
    name,
  ]);
  if (can_publish_club) audiences.unshift(['', t('Whole club')]);
  return (
    <>
      {published && <Notice text={t('Announcement published.')} />}
      {audiences.length > 0 &&
        (compose ? (
          <Compose
            audiences={audiences}
            onCancel={() => setCompose(false)}
            onPublished={() => {
              setCompose(false);
              setPublished(true);
              if (page) setPage(0);
              else void feed.refresh();
            }}
          />
        ) : (
          <Button
            title={t('New announcement')}
            icon="announcement"
            onPress={() => {
              setCompose(true);
              setPublished(false);
            }}
          />
        ))}
      {!items.length && (
        <Card>
          <Body>{t('No announcements on this page.')}</Body>
        </Card>
      )}
      {items.slice(0, announcementsPageSize).map((item) => (
        <Card key={item.id}>
          <Badge label={item.group_name ?? t('Whole club')} />
          <Heading>{item.title}</Heading>
          <Body>{item.body}</Body>
          <Body>{dueLabel(item.published_at)}</Body>
        </Card>
      ))}
      <Paging
        page={page}
        count={items.length}
        onChange={(next) => {
          setCompose(false);
          setPage(next);
        }}
      />
      <Button
        title={t('Refresh announcements')}
        variant="ghost"
        onPress={() => void feed.refresh()}
      />
    </>
  );
}
export default function Announcements() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Announcements')}>
      <Access member signInParams={{ next: 'announcements' }}>
        {({ profile }) => <Feed key={profile.id} />}
      </Access>
      <Button
        title={t('Back to home')}
        variant="secondary"
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
