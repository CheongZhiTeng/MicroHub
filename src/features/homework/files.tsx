import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Picker from 'expo-document-picker';
import { uuid } from 'expo';
import { Body, Button, Card, Field, Heading } from '../../components/ui';
import { client, publicConfig } from '../../lib/supabase';
import { useLanguage } from '../../locales/provider';
import {
  homework,
  useHomeworkAction,
  type Attachment,
  type Assignment,
} from './api';
import { Choices, Messages } from './controls';
export function FileList({ files }: { files: Attachment[] }) {
  const action = useHomeworkAction();
  return (
    <>
      {files
        .filter((f) => f.state === 'ready')
        .map((f) => (
          <Button
            key={f.id}
            variant="secondary"
            title={f.filename + ' · ' + Math.ceil(f.size_bytes / 1024) + ' KB'}
            onPress={() =>
              action.run(async () => {
                const { data, error } = await client().functions.invoke(
                  'homework-files?mode=download',
                  { body: { id: f.id } },
                );
                if (error || typeof data?.url !== 'string')
                  throw Error('File unavailable');
                if (Platform.OS === 'web') {
                  const link = document.createElement('a');
                  link.href = data.url;
                  link.download = f.filename;
                  link.rel = 'noreferrer';
                  link.click();
                } else await Linking.openURL(data.url);
              })
            }
          />
        ))}
      <Messages action={action} />
    </>
  );
}
export function FilePanel({
  assignment: a,
  files,
  reference = false,
  base = 0,
  editable,
  refresh,
}: {
  assignment: Assignment;
  files: Attachment[];
  reference?: boolean;
  base?: number;
  editable: boolean;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const action = useHomeworkAction();
  const [retry, setRetry] = useState<{
    id: string;
    file: Picker.DocumentPickerAsset;
  } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [limit, setLimit] = useState(String(a.file_limit ?? 0)),
    [mb, setMb] = useState(String((a.file_bytes ?? 5242880) / 1048576)),
    [mode, setMode] = useState(a.file_mode ?? 'any');
  async function upload(repeat: boolean) {
    let entry = retry;
    if (!repeat) {
      const picked = await Picker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'],
      });
      if (picked.canceled) return;
      entry = { id: uuid.v4(), file: picked.assets[0]! };
      setRetry(entry);
    }

    if (!entry) return;
    const { file, id } = entry;
    if (
      file.size !== undefined &&
      file.size > (reference ? 10485760 : (a.file_bytes ?? 0))
    )
      throw Error('File exceeds assignment limits');
    const form = new FormData();
    for (const [k, v] of Object.entries({
      id,
      assignment: a.id,
      reference: String(reference),
      base: String(base),
    }))
      form.append(k, v);
    if (Platform.OS === 'web' && file.file)
      form.append('file', file.file, file.name);
    else
      form.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
    const session = (await client().auth.getSession()).data.session;
    if (!session) throw Error('Sign in again');
    setProgress(0);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          'POST',
          new URL('/functions/v1/homework-files?mode=upload', publicConfig.url)
            .href,
        );
        xhr.timeout = 120000;
        xhr.setRequestHeader('Authorization', 'Bearer ' + session.access_token);
        xhr.setRequestHeader('apikey', publicConfig.key!);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onerror = xhr.ontimeout = () =>
          reject(Error('Upload interrupted. Retry the same file.'));
        xhr.onload = () => {
          let message = 'Upload failed';
          try {
            message = JSON.parse(xhr.responseText).error ?? message;
          } catch {}
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(Error(message));
        };
        xhr.send(form);
      });
      setRetry(null);
    } finally {
      setProgress(null);
      await refresh();
    }
  }
  return (
    <Card>
      <Heading>{t(reference ? 'Reference files' : 'Your files')}</Heading>
      <FileList files={files} />
      {reference && editable && (
        <>
          {a.joint !== undefined && !!a.file_limit && (
            <Button
              title={t(
                a.allow_text || a.allow_link
                  ? 'Require files only'
                  : 'Allow text and links too',
              )}
              variant="secondary"
              onPress={() =>
                action.run(async () => {
                  await homework('hw_media_only', {
                    p_id: a.id,
                    p_revision: a.revision,
                    p_only: a.allow_text || a.allow_link,
                  });
                  await refresh();
                })
              }
            />
          )}
          <Field
            label={t('Files per submission (0–10)')}
            value={limit}
            keyboardType="number-pad"
            onChangeText={setLimit}
          />
          <Field
            label={t('Maximum MB per file (up to 10)')}
            value={mb}
            keyboardType="decimal-pad"
            onChangeText={setMb}
          />
          <Choices
            value={mode}
            items={[
              ['any', t('Documents and photos')],
              ['document', t('Documents')],
              ['photo', t('Photos')],
            ]}
            onChange={setMode}
          />
          <Button
            title={t('Save file rules')}
            busy={action.busy}
            onPress={() =>
              action.run(async () => {
                if (
                  !/^\d+$/.test(limit) ||
                  Number(limit) > 10 ||
                  !(Number(mb) > 0 && Number(mb) <= 10)
                )
                  throw Error('Check file limits.');
                await homework('hw_file_settings', {
                  p_id: a.id,
                  p_revision: a.revision,
                  p_limit: Number(limit),
                  p_bytes: Math.round(Number(mb) * 1048576),
                  p_mode: mode,
                });
                await refresh();
              })
            }
          />
        </>
      )}
      {!reference && (
        <Body>
          {t('File limit')} · {a.file_limit} × {(a.file_bytes ?? 0) / 1048576}{' '}
          MB · {t(a.file_mode ?? 'any')}
        </Body>
      )}
      {editable && (
        <>
          {files.map((f) => (
            <Button
              variant="ghost"
              key={f.id}
              title={t('Remove file') + ' · ' + f.filename}
              onPress={() =>
                action.run(async () => {
                  await homework('hw_file_remove', { p_file: f.id });
                  await refresh();
                })
              }
            />
          ))}
          <Button
            title={t('Choose file or photo')}
            busy={action.busy}
            onPress={() => action.run(() => upload(false))}
          />
          {progress !== null && (
            <Body>
              {t('Upload progress')} · {progress}%
            </Body>
          )}
          {Boolean(action.error) && retry && (
            <Button
              title={t('Retry upload')}
              onPress={() => action.run(() => upload(true))}
            />
          )}
        </>
      )}
      <Messages action={action} />
    </Card>
  );
}
