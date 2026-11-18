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
  Avatar,
  SectionTitle,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import type { Identity } from '../src/features/identity';
import { client } from '../src/lib/supabase';
import { errorMessage } from '../src/lib/validation';
function ProfileForm({ identity }: { identity: Identity }) {
  const [name, setName] = useState(identity.profile.display_name);
  const [className, setClassName] = useState(identity.profile.class_name);
  const { busy, start, finish } = useBusy();
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const save = async () => {
    if (!start()) return;
    setMessage('');
    setFailed(false);
    try {
      if (!name.trim() || !className.trim())
        throw new Error('Enter your name and class.');
      const { data, error } = await client()
        .from('profiles')
        .update({ display_name: name.trim(), class_name: className.trim() })
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
      <Avatar name={name} size={64} />
      <SectionTitle icon="user">Personal details</SectionTitle>
      <Body>Student ID: {identity.profile.student_id}</Body>
      <Field
        label="Full name"
        value={name}
        onChangeText={setName}
        maxLength={100}
        autoComplete="name"
      />
      <Field
        label="Class"
        value={className}
        onChangeText={setClassName}
        maxLength={40}
      />
      {Boolean(message) && <Notice error={failed} text={message} />}
      <Button title="Save profile" busy={busy} onPress={() => void save()} />
    </Card>
  );
}
export default function Profile() {
  return (
    <Screen
      title="My profile"
      subtitle="A familiar face in your school community."
    >
      <Access>
        {(identity) => (
          <ProfileForm key={identity.profile.id} identity={identity} />
        )}
      </Access>
      <Button
        title="Back to home"
        secondary
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
