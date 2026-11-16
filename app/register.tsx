import { useBusy } from '../src/features/busy';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  Field,
  Notice,
  Screen,
  PasswordField,
} from '../src/components/ui';
import { client } from '../src/lib/supabase';
import {
  errorMessage,
  isSchoolEmail,
  validPassword,
  PASSWORD_RULE,
  normalizeEmail,
  validOtp,
} from '../src/lib/validation';
export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, start, finish } = useBusy();
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const submit = async () => {
    setMessage('');
    setFailed(false);
    if (!start()) return;
    try {
      if (!isSchoolEmail(normalizeEmail(email)))
        throw new Error(
          'Enter your official saXXXXXX@foonyewsa.edu.my address.',
        );
      if (sent) {
        if (!validOtp(token))
          throw new Error('Enter the six-digit verification code.');
        const { error } = await client().auth.verifyOtp({
          email: normalizeEmail(email),
          token,
          type: 'signup',
        });
        if (error) throw error;
        router.replace('/');
      } else {
        if (!validPassword(password)) throw new Error(PASSWORD_RULE);
        const { error } = await client().auth.signUp({
          email: normalizeEmail(email),
          password,
        });
        if (error) throw error;
        setEmail(normalizeEmail(email));
        setSent(true);
        setPassword('');
      }
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      finish();
    }
  };
  const resend = async () => {
    if (!start()) return;
    setMessage('');
    setFailed(false);
    try {
      const { error } = await client().auth.resend({
        type: 'signup',
        email: normalizeEmail(email),
      });
      if (error) throw error;
      setMessage('A new code has been requested. Check your inbox.');
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <Screen
      auth
      title={sent ? 'Verify your email' : 'Join your club'}
      subtitle="Your school email establishes your identity. Membership is approved separately."
    >
      <Card>
        <Field
          label="School email"
          value={email}
          onChangeText={setEmail}
          editable={!sent && !busy}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoCorrect={false}
        />
        {sent ? (
          <>
            <Notice text="Check your school inbox for a six-digit code. Codes expire after 10 minutes." />
            <Field
              label="Verification code"
              editable={!busy}
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </>
        ) : (
          <PasswordField
            label="Password (8–128 characters)"
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            creating
          />
        )}
        {Boolean(message) && <Notice error={failed} text={message} />}
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
          title={
            sent
              ? 'Use a different email'
              : 'I already have a verification code'
          }
          secondary
          busy={busy}
          onPress={() => {
            setMessage('');
            setFailed(false);
            setToken('');
            if (sent) {
              setSent(false);
              return;
            }
            if (!isSchoolEmail(normalizeEmail(email))) {
              setFailed(true);
              setMessage('Enter your school email first.');
              return;
            }
            setEmail(normalizeEmail(email));
            setPassword('');
            setSent(true);
          }}
        />
        <Button
          title="Back to sign in"
          secondary
          busy={busy}
          onPress={() => router.replace('/sign-in')}
        />
      </Card>
    </Screen>
  );
}
