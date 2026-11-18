import { useBusy } from '../src/features/busy';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import type { InputHandle } from '../src/components/ui';
import {
  Button,
  Card,
  Field,
  Notice,
  Screen,
  PasswordField,
} from '../src/components/ui';
import { useSession } from '../src/features/session';
import { client, configured } from '../src/lib/supabase';
import {
  errorMessage,
  isSchoolEmail,
  normalizeEmail,
} from '../src/lib/validation';
import { en } from '../src/locales/en';
export default function SignIn() {
  const { session, recovery } = useSession();
  const passwordRef = useRef<InputHandle>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, start, finish } = useBusy();
  const [error, setError] = useState('');
  if (!configured) return <Redirect href="/" />;
  if (session) return <Redirect href={recovery ? '/recover' : '/(tabs)'} />;
  const login = async () => {
    setError('');
    if (!isSchoolEmail(normalizeEmail(email))) {
      setError('Use sa followed by exactly six digits @foonyewsa.edu.my.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    if (!start()) return;
    try {
      const { error } = await client().auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error) throw error;
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <Screen auth title="Welcome back" subtitle={en.tagline}>
      <Card>
        <Field
          label="School email"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="sa123456@foonyewsa.edu.my"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          autoCorrect={false}
        />
        <PasswordField
          inputRef={passwordRef}
          onSubmitEditing={() => void login()}
          label="Password"
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />
        {Boolean(error) && <Notice error text={error} />}
        <Button title="Sign in" busy={busy} onPress={() => void login()} />
        <Button
          title="Create a school account"
          secondary
          busy={busy}
          onPress={() => router.push('/register')}
        />
        <Button
          title="Reset password"
          quiet
          busy={busy}
          onPress={() => router.push('/recover')}
        />
      </Card>
    </Screen>
  );
}
