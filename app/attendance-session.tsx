import { useLocalSearchParams } from 'expo-router';
import { Access } from '../src/features/access';
import { Screen, Notice } from '../src/components/ui';
import { useLanguage } from '../src/locales/provider';
import { AttendanceSession } from '../src/features/attendance/session';
export default function SessionPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLanguage();
  return (
    <Screen title={t('Attendance session')}>
      <Access member signInParams={{ next: 'attendance-session', id }}>
        {(u) =>
          id && /^[0-9a-f-]{36}$/i.test(id) ? (
            <AttendanceSession key={u.profile.id + id} id={id} />
          ) : (
            <Notice error text={t('Session unavailable')} />
          )
        }
      </Access>
    </Screen>
  );
}
