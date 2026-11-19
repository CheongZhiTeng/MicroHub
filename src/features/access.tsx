import { useLanguage } from '../locales/provider';
import { Redirect } from 'expo-router';
import { Button, Loading, Notice } from '../components/ui';
import { useIdentity, type Identity } from './identity';
import { useSession } from './session';
export function Access({
  children,
  signInParams,
  admin = false,
  member = false,
}: {
  children: (identity: Identity) => React.ReactNode;
  signInParams?: { next: string; id?: string; mode?: string; copy?: string };
  admin?: boolean;
  member?: boolean;
}) {
  const { t } = useLanguage();
  const { session, loading: sessionLoading, recovery } = useSession();
  const { identity, loading, error, reload } = useIdentity();
  if (sessionLoading) return <Loading />;
  if (!session)
    return (
      <Redirect
        href={
          signInParams
            ? { pathname: '/sign-in', params: signInParams }
            : '/sign-in'
        }
      />
    );
  if (recovery) return <Redirect href="/recover" />;
  if (loading && !identity) return <Loading />;
  if (error)
    return (
      <>
        <Notice error text={error} />
        <Button title={t('Retry')} onPress={() => void reload()} />
      </>
    );
  if (!identity || identity.profile.status === 'suspended')
    return (
      <Notice
        error
        text={t(
          'Your account is unavailable. Contact your school administrator.',
        )}
      />
    );
  if ((member || admin) && !identity.member)
    return <Notice text={t('An approved club membership is required.')} />;
  if (admin && identity.role === 'member')
    return <Notice error text={t('Administrator access is required.')} />;
  return <>{children(identity)}</>;
}
