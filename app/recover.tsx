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
import { useSession } from '../src/features/session';
import { client } from '../src/lib/supabase';
import {
  errorMessage,
  isSchoolEmail,
  validPassword,
  PASSWORD_RULE,
  normalizeEmail,
  validOtp,
} from '../src/lib/validation';
export default function Recover() {
  const { recovery, setRecovery } = useSession();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const { busy, start, finish } = useBusy();
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const submit = async () => {
    if (!start()) return;
    setMessage('');
    setFailed(false);
    try {
      if (recovery) {
        if (!passwordSaved) {
          if (!validPassword(password)) throw new Error(PASSWORD_RULE);
          const { error } = await client().auth.updateUser({ password });
          if (error) throw error;
          setPasswordSaved(true);
          setPassword('');
        }
        const { error: signOutError } = await client().auth.signOut({
          scope: 'global',
        });
        if (signOutError) throw signOutError;
        setRecovery(false);
        router.replace('/sign-in');
      } else if (sent) {
        if (!validOtp(token))
          throw new Error('Enter the six-digit recovery code.');
        const { error } = await client().auth.verifyOtp({
          email: normalizeEmail(email),
          token,
          type: 'recovery',
        });
        if (error) throw error;
        setRecovery(true);
      } else {
        if (!isSchoolEmail(normalizeEmail(email)))
          throw new Error('Enter your official school email.');
        const { error } = await client().auth.resetPasswordForEmail(
          normalizeEmail(email),
        );
        if (error) throw error;
        setSent(true);
      }
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      finish();
    }
  };
  const cancel = async () => {
    if (!start()) return;
    try {
      if (recovery) {
        const { error } = await client().auth.signOut();
        if (error) throw error;
      }
      setRecovery(false);
      router.replace('/sign-in');
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <Screen
      title="Reset your password"
      subtitle="Use the code in your school email on this device."
    >
      <Card>
        {recovery ? (
          passwordSaved ? (
            <Notice text="Password saved. Finish signing out before signing in again." />
          ) : (
            <PasswordField
              label="New password"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              creating
            />
          )
        ) : (
          <>
            <Field
              label="School email"
              value={email}
              onChangeText={setEmail}
              editable={!sent && !busy}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {sent && (
              <>
                <Notice text="If this account exists, a recovery code has been sent. It expires in 10 minutes." />
                <Field
                  label="Recovery code"
                  editable={!busy}
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
        {Boolean(message) && <Notice error={failed} text={message} />}
        <Button
          title={
            recovery
              ? passwordSaved
                ? 'Retry sign out'
                : 'Save password and sign out'
              : sent
                ? 'Verify recovery code'
                : 'Send recovery code'
          }
          busy={busy}
          onPress={() => void submit()}
        />
        {sent && !recovery && (
          <Button
            title="Request a new recovery code"
            secondary
            busy={busy}
            onPress={() => {
              setSent(false);
              setToken('');
              setMessage('');
              setFailed(false);
            }}
          />
        )}
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
