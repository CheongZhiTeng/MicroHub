import { launchImageLibraryAsync } from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Profile } from './identity';
import { useBusy } from './busy';
import { Avatar, Body, Button, Notice } from '../components/ui';
import { Icon } from '../components/icon';
import { useTheme } from '../theme/provider';
import { useLanguage } from '../locales/provider';
import { client } from '../lib/supabase';
import { errorMessage } from '../lib/validation';

type Preview = { uri: string; bytes: ArrayBuffer };
async function choosePhoto(): Promise<Preview | null> {
  const chosen = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (chosen.canceled) return null;
  const { ImageManipulator, SaveFormat } =
    await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(chosen.assets[0]!.uri);
  try {
    // Decode before measuring to respect phone camera orientation and web file metadata.
    const original = await context.renderAsync();
    const side = Math.min(original.width, original.height);
    const width = original.width,
      height = original.height;
    original.release();
    context
      .crop({
        originX: Math.floor((width - side) / 2),
        originY: Math.floor((height - side) / 2),
        width: side,
        height: side,
      })
      .resize({ width: 256, height: 256 });
    const rendered = await context.renderAsync();
    try {
      const small = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.85,
        base64: true,
      });
      if (!small.base64) throw Error('Invalid profile photo.');
      return {
        uri: small.uri,
        bytes: Uint8Array.from(atob(small.base64), (c) => c.charCodeAt(0))
          .buffer,
      };
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}
export function ProfilePhoto({
  profile,
  name,
  refresh,
}: {
  profile: Profile;
  name: string;
  refresh: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { busy, start, finish } = useBusy();
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(
    () => () => {
      if (preview?.uri.startsWith('blob:')) URL.revokeObjectURL(preview.uri);
    },
    [preview],
  );
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  async function choose() {
    if (!start()) return;
    setError('');
    try {
      if (profile.avatar_id === undefined)
        throw Error('Profile photos are not available yet.');
      const chosen = await choosePhoto();
      if (chosen) {
        setPreview(chosen);
        setConfirmRemove(false);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      finish();
    }
  }
  async function save(remove: boolean) {
    if (!start()) return;
    setError('');
    try {
      const mode = remove ? 'remove' : 'upload';
      const { error } = await client().functions.invoke(
        'profile-avatar?mode=' +
          mode +
          '&previous=' +
          (profile.avatar_id ?? ''),
        {
          body: remove ? '' : preview?.bytes,
          headers: { 'Content-Type': remove ? 'text/plain' : 'image/jpeg' },
        },
      );
      if (error) {
        const response = error.context;
        const detail = await response?.json?.().catch(() => null);
        throw Error(detail?.message ?? 'Photo could not be saved.');
      }
      await refresh();
      setPreview(null);
      setConfirmRemove(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      finish();
    }
  }
  return (
    <View style={{ gap: 10, alignItems: 'flex-start' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Change profile photo')}
        disabled={busy}
        onPress={() => void choose()}
        style={{ padding: 4 }}
      >
        <Avatar
          name={name}
          size={76}
          owner={profile.id}
          version={profile.avatar_id}
          preview={preview?.uri}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: theme.color.primary,
            borderRadius: 14,
            padding: 5,
          }}
        >
          <Icon name="edit" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
      {preview ? (
        <>
          <Body>{t('Photo preview')}</Body>
          <Button
            title={t('Save photo')}
            busy={busy}
            onPress={() => void save(false)}
          />
          <Button
            title={t('Cancel')}
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setError('');
              setPreview(null);
            }}
          />
        </>
      ) : profile.avatar_id ? (
        <>
          {confirmRemove && <Body>{t('Remove your profile photo?')}</Body>}
          <Button
            variant="ghost"
            title={t(confirmRemove ? 'Confirm removal' : 'Remove photo')}
            busy={busy}
            onPress={() =>
              confirmRemove ? void save(true) : setConfirmRemove(true)
            }
          />
          {confirmRemove && (
            <Button
              title={t('Cancel')}
              variant="ghost"
              disabled={busy}
              onPress={() => setConfirmRemove(false)}
            />
          )}
        </>
      ) : null}
      {Boolean(error) && <Notice error text={t(error)} />}
    </View>
  );
}
