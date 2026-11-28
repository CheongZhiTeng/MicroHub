import { Access } from '../src/features/access';
import { ClubAdmin } from '../src/features/club/manage';
import { Screen, Notice } from '../src/components/ui';
import { useLanguage } from '../src/locales/provider';
export default function AdminPage() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Club administration')}>
      <Access admin signInParams={{ next: 'club-admin' }}>
        {(u) =>
          u.role === 'super_admin' ? (
            <ClubAdmin key={u.profile.id} actor={u.profile.id} />
          ) : (
            <Notice error text={t('Full administrator required.')} />
          )
        }
      </Access>
    </Screen>
  );
}
