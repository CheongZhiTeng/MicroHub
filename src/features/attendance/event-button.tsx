import { router } from 'expo-router';
import { Button } from '../../components/ui';
import { useLanguage } from '../../locales/provider';
import type { ClassEvent } from '../class-scope';

export function EventAttendanceButton({ event }: { event: ClassEvent }) {
  const { t } = useLanguage();
  if (event.cancelled) return null;
  return (
    <Button
      title={t('Event check-in')}
      accessibilityLabel={t('Event check-in') + ' · ' + event.title}
      variant="secondary"
      onPress={() =>
        router.push({ pathname: '/attendance-new', params: { id: event.id } })
      }
    />
  );
}
