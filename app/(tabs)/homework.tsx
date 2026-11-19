import { useLanguage } from '../../src/locales/provider';
import { Screen } from '../../src/components/ui';
import { Access } from '../../src/features/access';
import { AssignmentList } from '../../src/features/homework/list';
export default function Homework() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Assignments')}>
      <Access member>
        {(identity) => (
          <AssignmentList
            key={identity.profile.id + identity.role}
            identity={identity}
          />
        )}
      </Access>
    </Screen>
  );
}
