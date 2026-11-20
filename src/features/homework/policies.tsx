import { useState } from 'react';
import { Body, Button, Card, Field, Heading } from '../../components/ui';
import { useLanguage } from '../../locales/provider';
import {
  dateInput,
  homework,
  parseDate,
  useHomeworkAction,
  type Assignment,
  type Recipient,
} from './api';
import { Choices, Messages } from './controls';
export function PolicyEditor({
  assignment: a,
  recipient: r,
  refresh,
}: {
  assignment: Assignment;
  recipient?: Recipient;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const action = useHomeworkAction();
  const [mode, setMode] = useState('');
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState(
    r ? (r.extension_at ? dateInput(r.extension_at) : '') : dateInput(a.due_at),
  );
  const [description, setDescription] = useState(a.instructions);
  const [flag, setFlag] = useState(
    r ? r.submission === 'Excused' : a.allow_late,
  );
  if (a.lifecycle === 'archived' || a.lifecycle === 'draft' || r?.detached)
    return null;
  const options: [string, string][] = r
    ? [['exception', 'Individual arrangements']]
    : [
        ['edit', 'Edit published settings'],
        a.lifecycle === 'closed'
          ? ['reopen', 'Reopen assignment']
          : ['close', 'Close assignment'],
        ['archive', 'Archive assignment'],
      ];
  const submit = () =>
    action.run(async () => {
      if (!reason.trim()) throw Error('Enter a reason for the change.');
      if (r)
        await homework('hw_exception', {
          p_id: a.id,
          p_member: r.member_id,
          p_revision: r.exception_revision,
          p_excused: flag,
          p_extension: deadline.trim() ? parseDate(deadline) : null,
          p_reason: reason,
        });
      else
        await homework('hw_maintain', {
          p_id: a.id,
          p_revision: a.revision,
          p_action: mode,
          p_reason: reason,
          ...(mode === 'edit'
            ? {
                p_due: parseDate(deadline),
                p_late: flag,
                p_instructions: description,
              }
            : {}),
        });
      setMode('');
      setReason('');
      await refresh();
      return t('Changes saved.');
    });
  return (
    <Card>
      <Heading>{t(r ? 'Recipient settings' : 'Assignment settings')}</Heading>
      <Choices
        items={options.map(([k, v]) => [k, t(v)])}
        value={mode}
        onChange={setMode}
      />
      {Boolean(mode) && (
        <>
          {(r || mode === 'edit') && (
            <>
              <Field
                label={t(
                  r
                    ? 'Individual deadline (blank to clear)'
                    : 'Deadline (Malaysia time)',
                )}
                value={deadline}
                onChangeText={setDeadline}
                hint="YYYY-MM-DD HH:mm"
              />
              {!r && (
                <Field
                  label={t('Instructions')}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={20000}
                />
              )}
              <Choices
                value={flag ? 'yes' : 'no'}
                items={
                  r
                    ? [
                        ['no', t('Required')],
                        ['yes', t('Excused')],
                      ]
                    : [
                        ['yes', t('Accept late work')],
                        ['no', t('On time only')],
                      ]
                }
                onChange={(x) => setFlag(x === 'yes')}
              />
            </>
          )}
          {mode === 'edit' && (
            <Body>
              {t(
                'Changes apply to this roster. Individual deadlines and past receipts are preserved.',
              )}
            </Body>
          )}
          <Field
            label={t('Reason for change')}
            value={reason}
            maxLength={1000}
            onChangeText={setReason}
          />
          <Button
            title={t('Confirm change')}
            busy={action.busy}
            onPress={submit}
          />
          <Button
            title={t('Cancel')}
            variant="ghost"
            onPress={() => setMode('')}
          />
        </>
      )}
      <Messages action={action} />
    </Card>
  );
}
