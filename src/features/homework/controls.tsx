import { MotionPressable } from '../../components/motion';
import { useTheme } from '../../theme/provider';
import { useLanguage } from '../../locales/provider';
import { useState } from 'react';
import { Linking, View, Text, Platform, type ViewProps } from 'react-native';
import {
  Badge,
  Button,
  Body,
  Card,
  Heading,
  Loading,
  Notice,
} from '../../components/ui';
import {
  dueLabel,
  pageSize,
  type Assignment,
  type Recipient,
  type Version,
} from './api';
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
  const { theme } = useTheme();
  const keyboard =
    Platform.OS === 'web' && !disabled
      ? {
          onKeyDown(
            event:
              | React.KeyboardEvent<HTMLElement>
              | Parameters<NonNullable<ViewProps['onKeyDown']>>[0],
          ) {
            if (!('key' in event)) return;
            const radios = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                '[role="radio"]',
              ),
            );
            const index = radios.indexOf(event.target as HTMLElement);
            if (index < 0) return;
            let next: number;
            switch (event.key) {
              case 'ArrowRight':
              case 'ArrowDown':
                next = (index + 1) % items.length;
                break;
              case 'ArrowLeft':
              case 'ArrowUp':
                next = (index + items.length - 1) % items.length;
                break;
              case 'Home':
                next = 0;
                break;
              case 'End':
                next = items.length - 1;
                break;
              default:
                return;
            }
            event.preventDefault();
            radios[next]?.focus();
            onChange(items[next]![0]);
          },
        }
      : {};
  return (
    <View
      {...keyboard}
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
    >
      {items.map(([id, label]) => {
        const checked = value === id;
        return (
          <MotionPressable
            key={id}
            accessibilityRole="radio"
            tabIndex={
              disabled || (!checked && items.some(([key]) => key === value))
                ? -1
                : 0
            }
            accessibilityLabel={label}
            aria-checked={checked}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => onChange(id)}
            style={({ pressed, hovered }) => ({
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: theme.radii.sm,
              borderWidth: 1,
              borderColor: checked ? theme.color.primary : theme.color.border,
              backgroundColor:
                checked || hovered ? theme.color.subtle : theme.color.surface,
              opacity: disabled || pressed ? 0.7 : 1,
              maxWidth: '100%',
            })}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: checked ? 5 : 1.5,
                borderColor: checked ? theme.color.primary : theme.color.muted,
              }}
            />
            <Text
              style={{
                fontFamily: theme.font,
                color: checked ? theme.color.primaryDark : theme.color.text,
                fontSize: 14,
                fontWeight: checked ? '700' : '500',
                flexShrink: 1,
              }}
            >
              {label}
            </Text>
          </MotionPressable>
        );
      })}
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
  status,
}: {
  assignment: Assignment;
  due?: string;
  status?: Recipient | null;
}) {
  const { t } = useLanguage();
  return (
    <Card>
      {status && (
        <Badge
          label={[status.submission, status.modification, status.grading]
            .filter((v): v is string => !!v)
            .map(t)
            .join(' · ')}
        />
      )}
      <Heading>{a.title}</Heading>
      {a.joint && <Body>{t('Shared group submission')}</Body>}
      {a.group_name && <Body>{a.group_name}</Body>}
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
      {Boolean(a.instructions) && (
        <>
          <Heading>{t('Instructions')}</Heading>
          <Body>{a.instructions}</Body>
        </>
      )}
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
            {e.supersedes && e.kind === 'release'
              ? t('Grade corrected')
              : e.kind === 'revision'
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
