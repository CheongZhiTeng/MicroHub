import { Screen } from '../src/components/ui';
import { Access } from '../src/features/access';
import { AssignmentList } from '../src/features/homework/list';
export default function Submissions() {
  return (
    <Screen title="My submissions">
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
