import { router } from 'expo-router';

import { useState } from 'react';
import {
  Badge,
  Body,
  Button,
  Card,
  Heading,
  Screen,
} from '../src/components/ui';
import { ClassScope } from '../src/features/class-scope';
import { Access } from '../src/features/access';
import {
  announcementsPageSize,
  useAnnouncements,
} from '../src/features/announcements';

import { dueLabel } from '../src/features/homework/api';
import { FetchState, Paging } from '../src/features/homework/controls';

import { useLanguage } from '../src/locales/provider';

function Feed() {
  const [scope, setScope] = useState('all');
  const { t } = useLanguage();
  const [page, setPage] = useState(0);
  const feed = useAnnouncements(page, false, scope);
  if (!feed.data)
    return (
      <>
        <ClassScope
          value={scope}
          change={(s) => {
            setScope(s);
            setPage(0);
          }}
        />
        <FetchState error={feed.error} retry={feed.refresh} />
      </>
    );
  const { items, groups, can_publish_club } = feed.data;
  return (
    <>
      <ClassScope
        value={scope}
        change={(s) => {
          setScope(s);
          setPage(0);
        }}
        groups={groups}
      />
      {(can_publish_club || groups.length > 0) && (
        <Button
          title={t('New announcement')}
          icon="announcement"
          onPress={() => router.push('/announcement-editor')}
        />
      )}
      {!items.length && (
        <Card>
          <Body>{t('No announcements on this page.')}</Body>
        </Card>
      )}
      {items.slice(0, announcementsPageSize).map((item) => (
        <Card key={item.id}>
          <Badge label={item.group_name ?? t('Big class')} />
          <Heading>{item.title}</Heading>
          <Body>{item.body}</Body>
          <Body>{dueLabel(item.published_at)}</Body>
        </Card>
      ))}
      <Paging
        page={page}
        count={items.length}
        onChange={(next) => {
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
