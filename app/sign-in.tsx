import { useLanguage } from '../src/locales/provider';
import { useBusy } from '../src/features/busy';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
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
  const { t } = useLanguage();
  const { next, id, mode, copy } = useLocalSearchParams<{
    next?: string;
    id?: string;
    mode?: string;
    copy?: string;
  }>();
  const { session, recovery } = useSession();
  const passwordRef = useRef<InputHandle>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, start, finish } = useBusy();
  const [error, setError] = useState('');
  if (!configured) return <Redirect href="/" />;
  if (session) {
    if (recovery) return <Redirect href="/recover" />;
    const validId = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
    if (next === 'groups') return <Redirect href="/groups" />;
    if (next === 'assignment-editor')
      return (
        <Redirect
          href={{
            pathname: '/assignment-editor',
            params: {
              ...(validId(id) ? { id } : {}),
              ...(validId(copy) ? { copy } : {}),
            },
          }}
        />
      );
    if (next === 'assignment' && validId(id))
      return (
        <Redirect
          href={{
            pathname: '/assignment',
            params: { id, mode: mode === 'manage' ? 'manage' : 'mine' },
          }}
        />
      );
    if (next === 'homework' || next === 'submissions')
      return (
        <Redirect href={next === 'homework' ? '/homework' : '/submissions'} />
      );
    return <Redirect href="/(tabs)" />;
  }
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
    <Screen auth title={t('Welcome back')} subtitle={t(en.tagline)}>
      <Card>
        <Field
          label={t('School email')}
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
          label={t('Password')}
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />
        {Boolean(error) && <Notice error text={error} />}
        <Button
          fullWidth
          title={t('Sign in')}
          busy={busy}
          onPress={() => void login()}
        />
        <Button
          fullWidth
          title={t('Create a school account')}
          variant="ghost"
          busy={busy}
          onPress={() => router.push('/register')}
        />
        <Button
          fullWidth
          title={t('Reset password')}
          variant="ghost"
          busy={busy}
          onPress={() => router.push('/recover')}
        />
      </Card>
    </Screen>
  );
}
