import { useState } from 'react';
import { router } from 'expo-router';
import { Access } from '../src/features/access';
import {
  Body,
  Button,
  Card,
  Heading,
  NavigationRow,
  Screen,
} from '../src/components/ui';
import {
  homework,
  useHomework,
  useHomeworkAction,
} from '../src/features/homework/api';
import {
  FetchState,
  Messages,
  Paging,
} from '../src/features/homework/controls';
import { useLanguage } from '../src/locales/provider';
function Inbox() {
  const { t, dueLabel } = useLanguage(),
    [page, setPage] = useState(0),
    act = useHomeworkAction(),
    inbox = useHomework('hw_inbox', { p_page: page });
  if (!inbox.data)
    return <FetchState retry={inbox.refresh} error={inbox.error} />;
  const { preferences, items } = inbox.data;
  return (
    <>
      <Card>
        <Heading>{t('Homework reminders')}</Heading>
        {items.slice(0, 20).map((x, i) => (
          <NavigationRow
            key={i}
            icon="bell"
            title={x.title}
            subtitle={t(x.kind) + ' · ' + dueLabel(x.at_time)}
            onPress={() =>
              router.push({
                pathname: '/assignment',
                params: { id: x.id, mode: x.mode },
              })
            }
          />
        ))}
        {!items.length && <Body>{t('No homework notifications.')}</Body>}
        <Paging page={page} count={items.length} onChange={setPage} />
        <Button title={t('Refresh')} onPress={inbox.refresh} />
      </Card>
      <Card>
        <Heading>{t('Notification preferences')}</Heading>
        {(['due', 'feedback', 'grading'] as const).map((k) => (
          <Button
            key={k}
            title={
              t(
                {
                  due: 'Deadline reminders',
                  feedback: 'Returned feedback',
                  grading: 'Grading reminders',
                }[k],
              ) +
              ' · ' +
              t(preferences[k] ? 'On' : 'Off')
            }
            variant="secondary"
            busy={act.busy}
            onPress={() =>
              act.run(async () => {
                const p = { ...preferences, [k]: !preferences[k] };
                await homework('hw_preferences', {
                  p_due: p.due,
                  p_feedback: p.feedback,
                  p_grading: p.grading,
                });
                setPage(0);
                await inbox.refresh();
              })
            }
          />
        ))}
        <Messages action={act} />
      </Card>
    </>
  );
}
export default function Notifications() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Notifications')}>
      <Access member signInParams={{ next: 'notifications' }}>
        {(user) => <Inbox key={user.profile.id} />}
      </Access>
      <Button
        title={t('Back to home')}
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
