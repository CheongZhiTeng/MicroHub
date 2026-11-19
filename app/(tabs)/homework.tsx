import { Screen } from '../../src/components/ui';
import { Access } from '../../src/features/access';
import { AssignmentList } from '../../src/features/homework/list';
export default function Homework() {
  return (
    <Screen title="Assignments">
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
