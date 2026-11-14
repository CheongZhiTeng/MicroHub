import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Field, Notice, Screen } from '../src/components/ui';
import { client } from '../src/lib/supabase';
import {
  errorMessage,
  isSchoolEmail,
  validPassword,
} from '../src/lib/validation';
export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    setMessage('');
    setBusy(true);
    try {
      if (!isSchoolEmail(email))
        throw new Error(
          'Enter your official saXXXXXX@foonyewsa.edu.my address.',
        );
      if (sent) {
        if (!/^\d{6}$/.test(token))
          throw new Error('Enter the six-digit verification code.');
        const { error } = await client().auth.verifyOtp({
          email,
          token,
          type: 'signup',
        });
        if (error) throw error;
        router.replace('/');
      } else {
        if (!validPassword(password))
          throw new Error('Use a password with 12 to 128 characters.');
        const { error } = await client().auth.signUp({ email, password });
        if (error) throw error;
        setSent(true);
        setPassword('');
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await client().auth.resend({ type: 'signup', email });
      if (error) throw error;
      setMessage('A new code has been requested. Check your inbox.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title={sent ? 'Verify your email' : 'Join your club'}
      subtitle="Your school email establishes your identity. Membership is approved separately."
    >
      <Card>
        <Field
          label="School email"
          value={email}
          onChangeText={setEmail}
          editable={!sent}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {sent ? (
          <>
            <Notice text="Check your school inbox for a six-digit code. Codes expire after 10 minutes." />
            <Field
              label="Verification code"
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </>
        ) : (
          <Field
            label="Password (12–128 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
        )}
        {message && <Notice text={message} />}
        <Button
          title={sent ? 'Verify email' : 'Create account'}
          busy={busy}
          onPress={() => void submit()}
        />
        {sent && (
          <Button
            title="Resend code"
            secondary
            busy={busy}
            onPress={() => void resend()}
          />
        )}
        <Button
          title="Back to sign in"
          secondary
          onPress={() => router.replace('/sign-in')}
        />
      </Card>
    </Screen>
  );
}
