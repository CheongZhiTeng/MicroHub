import { useLanguage } from '../src/locales/provider';
import { Screen } from '../src/components/ui';
import { Access } from '../src/features/access';
import { AssignmentList } from '../src/features/homework/list';
export default function Submissions() {
  const { t } = useLanguage();
  return (
    <Screen title={t('My submissions')}>
      <Access member signInParams={{ next: 'submissions' }}>
        {(identity) => (
          <AssignmentList
            key={identity.profile.id}
            submissions
            identity={identity}
          />
        )}
      </Access>
    </Screen>
  );
}
