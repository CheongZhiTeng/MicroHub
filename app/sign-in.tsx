import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Field, Notice, Screen } from '../src/components/ui';
import { useSession } from '../src/features/session';
import { client, configured } from '../src/lib/supabase';
import { errorMessage, isSchoolEmail } from '../src/lib/validation';
import { en } from '../src/locales/en';
export default function SignIn() {
  const { session, recovery } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!configured) return <Redirect href="/" />;
  if (session) return <Redirect href={recovery ? '/recover' : '/(tabs)'} />;
  const login = async () => {
    setError('');
    if (!isSchoolEmail(email)) {
      setError('Use sa followed by exactly six digits @foonyewsa.edu.my.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await client().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Welcome back" subtitle={en.tagline}>
      <Card>
        <Field
          label="School email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        {Boolean(error) && <Notice error text={error} />}
        <Button title="Sign in" busy={busy} onPress={() => void login()} />
        <Button
          title="Create a school account"
          secondary
          onPress={() => router.push('/register')}
        />
        <Button
          title="Reset password"
          secondary
          onPress={() => router.push('/recover')}
        />
      </Card>
    </Screen>
  );
}
