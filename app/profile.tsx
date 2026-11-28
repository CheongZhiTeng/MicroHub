import { officeLabel } from '../src/features/identity';
import { ProfilePhoto } from '../src/features/profile-photo';
import { hasBilingualNames } from '../src/lib/profile-name';
import { useLanguage } from '../src/locales/provider';
import { useBusy } from '../src/features/busy';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Body,
  Button,
  Card,
  Field,
  Notice,
  Screen,
  SectionTitle,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import type { Identity } from '../src/features/identity';
import { client } from '../src/lib/supabase';
import { errorMessage } from '../src/lib/validation';
function ProfileForm({
  identity,
  refresh,
}: {
  identity: Identity;
  refresh: () => Promise<void>;
}) {
  const { t, language } = useLanguage();
  const bilingual = hasBilingualNames(identity.profile);
  const [nameZh, setNameZh] = useState(identity.profile.name_zh ?? '');
  const [nameEn, setNameEn] = useState(
    bilingual
      ? (identity.profile.name_en ?? '')
      : identity.profile.display_name,
  );
  const [className, setClassName] = useState(identity.profile.class_name);
  const { busy, start, finish } = useBusy();
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const save = async () => {
    if (!start()) return;
    setMessage('');
    setFailed(false);
    try {
      if (!nameEn.trim() || !className.trim() || (bilingual && !nameZh.trim()))
        throw new Error(
          bilingual
            ? 'Enter your Chinese name, English name, and class.'
            : 'Enter your name and class.',
        );
      const { data, error } = await client()
        .from('profiles')
        .update({
          display_name: nameEn.trim(),
          ...(bilingual
            ? { name_en: nameEn.trim(), name_zh: nameZh.trim() }
            : {}),
          class_name: className.trim(),
        })
        .eq('id', identity.profile.id)
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Profile was not saved.');
      setMessage('Profile saved.');
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <Card>
      <ProfilePhoto
        profile={identity.profile}
        refresh={refresh}
        name={
          (language === 'zh' ? nameZh || nameEn : nameEn || nameZh) ||
          identity.profile.display_name
        }
      />
      {identity.role === 'super_admin' && (
        <Body>{t(officeLabel(identity.office))}</Body>
      )}
      <SectionTitle icon="user">{t('Personal details')}</SectionTitle>
      <Body>
        {t('Student ID: ')}
        {identity.profile.student_id}
      </Body>
      {bilingual && (
        <Field
          label={t('Chinese name')}
          value={nameZh}
          onChangeText={setNameZh}
          maxLength={100}
        />
      )}
      {bilingual &&
        !identity.profile.name_en &&
        !identity.profile.name_zh &&
        Boolean(identity.profile.display_name) && (
          <Body>
            {t('Previous display name')} · {identity.profile.display_name}
          </Body>
        )}
      <Field
        label={t(bilingual ? 'English name' : 'Full name')}
        value={nameEn}
        onChangeText={setNameEn}
        maxLength={100}
        autoComplete="name"
      />
      <Field
        label={t('Class')}
        value={className}
        onChangeText={setClassName}
        maxLength={40}
      />
      {Boolean(message) && <Notice error={failed} text={t(message)} />}
      <Button
        title={t('Save profile')}
        busy={busy}
        onPress={() => void save()}
      />
    </Card>
  );
}
export default function Profile() {
  const { t } = useLanguage();
  return (
    <Screen
      title={t('My profile')}
      subtitle={t('A familiar face in your school community.')}
    >
      <Access signInParams={{ next: 'profile' }}>
        {(identity, refresh) => (
          <ProfileForm
            key={
              identity.profile.id + ':' + hasBilingualNames(identity.profile)
            }
            identity={identity}
            refresh={refresh}
          />
        )}
      </Access>
      <Button
        title={t('Back to home')}
        variant="secondary"
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
