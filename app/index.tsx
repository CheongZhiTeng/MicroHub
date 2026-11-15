import { Redirect } from 'expo-router';
import { useSession } from '../src/features/session';
import { configured, configError } from '../src/lib/supabase';
import { en } from '../src/locales/en';
import { Button, Card, Loading, Notice, Screen } from '../src/components/ui';
export default function Index() {
  const { session, loading, recovery, error, retry } = useSession();
  if (!configured)
    return (
      <Screen title={en.missingConfig}>
        <Card>
          <Notice text={configError ?? en.configHelp} />
        </Card>
      </Screen>
    );
  if (loading)
    return (
      <Screen title={en.appName}>
        <Loading />
      </Screen>
    );
  if (error)
    return (
      <Screen title="Session unavailable">
        <Notice error text={error} />
        <Button title="Retry" onPress={retry} />
      </Screen>
    );
  return (
    <Redirect href={recovery ? '/recover' : session ? '/(tabs)' : '/sign-in'} />
  );
}
