import { useLanguage } from '../../locales/provider';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import {
  Button,
  Body,
  Card,
  Heading,
  Loading,
  Notice,
} from '../../components/ui';
import { dueLabel, pageSize, type Assignment, type Version } from './api';
export function Choices({
  items,
  value,
  onChange,
  disabled = false,
}: {
  items: readonly (readonly [string, string])[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([id, label]) => (
        <Button
          key={id}
          title={label}
          variant={value === id ? 'primary' : 'secondary'}
          icon={value === id ? 'check' : undefined}
          disabled={disabled}
          onPress={() => onChange(id)}
        />
      ))}
    </View>
  );
}
export function Paging({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (p: number) => void;
}) {
  const { t } = useLanguage();
  if (!page && count <= pageSize) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <Button
        title={t('Previous')}
        variant="secondary"
        disabled={page === 0}
        onPress={() => onChange(page - 1)}
      />
      <Body>
        {t('Page ')}
        {page + 1}
      </Body>
      <Button
        title={t('Next')}
        variant="secondary"
        disabled={count <= pageSize}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}
export function FetchState({
  error,
  retry,
}: {
  error?: string;
  retry: () => void;
}) {
  const { t } = useLanguage();
  return error ? (
    <Card>
      <Notice error text={error} />
      <Button title={t('Try again')} onPress={retry} />
    </Card>
  ) : (
    <Loading />
  );
}
export function Messages({
  action,
}: {
  action: { message: string; error: string };
}) {
  return (
    <>
      {Boolean(action.error) && <Notice error text={action.error} />}
      {Boolean(action.message) && <Notice text={action.message} />}
    </>
  );
}
export function Brief({
  assignment: a,
  due,
}: {
  assignment: Assignment;
  due?: string;
}) {
  const { t } = useLanguage();
  return (
    <Card>
      <Heading>{a.title}</Heading>
      {a.joint && <Body>{t('Shared group submission')}</Body>}
      {a.group_name && <Body>{a.group_name}</Body>}
      {Boolean(a.instructions) && <Body>{a.instructions}</Body>}
      <Body>
        {t('Due ')}
        {dueLabel(due ?? a.due_at)}
      </Body>
      <Body>
        {a.max_points === null ? t('Ungraded') : a.max_points + t(' points')} ·{' '}
        {[
          a.allow_text && t('Text'),
          a.allow_link && t('Link'),
          !!a.file_limit && t('Files'),
        ]
          .filter(Boolean)
          .join(' + ')}{' '}
        ·{' '}
        {a.allow_late
          ? t('Late submissions accepted')
          : t('On-time submissions only')}
      </Body>
    </Card>
  );
}
function SubmissionLink({ url }: { url: string }) {
  const { t } = useLanguage();
  const [error, setError] = useState('');
  const open = async () => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw Error();
      await Linking.openURL(parsed.href);
    } catch {
      setError('Could not open this link.');
    }
  };
  return (
    <View>
      <Body>{url}</Body>
      <Button title={t('Open submitted link')} variant="ghost" onPress={open} />
      {Boolean(error) && <Notice error text={error} />}
    </View>
  );
}
export function Receipt({ version: v }: { version: Version }) {
  const { t } = useLanguage();
  return (
    <Card>
      <Heading>
        {t('Version ')}
        {v.version} · {v.late ? t('Late') : t('On time')}
      </Heading>
      <Body>
        {t('Submitted ')}
        {dueLabel(v.submitted_at)}
      </Body>
      <Body>
        {t('Deadline used · ')}
        {dueLabel(v.effective_due_at)}
      </Body>
      {Boolean(v.body) && <Body>{v.body}</Body>}
      {Boolean(v.link) && <SubmissionLink url={v.link} />}
      {v.events.map((e) => (
        <View key={e.id} style={{ gap: 6 }}>
          <Heading>
            {e.kind === 'revision'
              ? t('Revision requested')
              : t('Feedback returned')}
          </Heading>
          <Body>{dueLabel(e.created_at)}</Body>
          {e.includes_grade && e.score !== null && (
            <Body>
              {t('Score · ')}
              {e.score}
            </Body>
          )}
          {Boolean(e.feedback) && <Body>{e.feedback}</Body>}
          {e.revision_due_at && (
            <Body>
              {t('Revise by ')}
              {dueLabel(e.revision_due_at)}
            </Body>
          )}
        </View>
      ))}
    </Card>
  );
}
