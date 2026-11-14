import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Field, Notice, Screen } from '../src/components/ui';
import { useSession } from '../src/features/session';
import { client } from '../src/lib/supabase';
import {
  errorMessage,
  isSchoolEmail,
  validPassword,
} from '../src/lib/validation';
export default function Recover() {
  const { recovery, setRecovery } = useSession();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (recovery) {
        if (!validPassword(password))
          throw new Error('Use a password with 12 to 128 characters.');
        const { error } = await client().auth.updateUser({ password });
        if (error) throw error;
        const { error: signOutError } = await client().auth.signOut({
          scope: 'global',
        });
        if (signOutError) throw signOutError;
        setRecovery(false);
        router.replace('/sign-in');
      } else if (sent) {
        if (!/^\d{6}$/.test(token))
          throw new Error('Enter the six-digit recovery code.');
        const { error } = await client().auth.verifyOtp({
          email,
          token,
          type: 'recovery',
        });
        if (error) throw error;
        setRecovery(true);
      } else {
        if (!isSchoolEmail(email))
          throw new Error('Enter your official school email.');
        const { error } = await client().auth.resetPasswordForEmail(email);
        if (error) throw error;
        setSent(true);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      if (recovery) {
        const { error } = await client().auth.signOut();
        if (error) throw error;
      }
      setRecovery(false);
      router.replace('/sign-in');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Reset your password"
      subtitle="Use the code in your school email on this device."
    >
      <Card>
        {recovery ? (
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
        ) : (
          <>
            <Field
              label="School email"
              value={email}
              onChangeText={setEmail}
              editable={!sent}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {sent && (
              <>
                <Notice text="If this account exists, a recovery code has been sent. It expires in 10 minutes." />
                <Field
                  label="Recovery code"
                  value={token}
                  onChangeText={setToken}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </>
            )}
          </>
        )}
        {message && <Notice text={message} />}
        <Button
          title={
            recovery
              ? 'Save password and sign out'
              : sent
                ? 'Verify recovery code'
                : 'Send recovery code'
          }
          busy={busy}
          onPress={() => void submit()}
        />
        <Button
          title="Back to sign in"
          secondary
          busy={busy}
          onPress={() => void cancel()}
        />
      </Card>
    </Screen>
  );
}
