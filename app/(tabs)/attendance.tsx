import { Screen } from '../../src/components/ui';
import { Access } from '../../src/features/access';
import { AttendanceOverview } from '../../src/features/attendance/overview';
import { useLanguage } from '../../src/locales/provider';
export default function AttendancePage() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Attendance')}>
      <Access member signInParams={{ next: 'attendance' }}>
        {(u) => (
          <AttendanceOverview
            key={u.profile.id}
            teach={u.role === 'super_admin'}
          />
        )}
      </Access>
    </Screen>
  );
}
