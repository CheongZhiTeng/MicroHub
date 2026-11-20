import {
  hasBilingualNames,
  profileName,
  type ProfileNames,
} from '../src/lib/profile-name';
import { useLanguage } from '../src/locales/provider';
import { useWindowDimensions } from 'react-native';
import { ConfirmDialog } from '../src/components/confirm-dialog';
import { useBusy } from '../src/features/busy';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Body,
  Button,
  Card,
  Heading,
  Loading,
  Notice,
  Screen,
  Badge,
  SectionTitle,
} from '../src/components/ui';
import { Access } from '../src/features/access';
import { client } from '../src/lib/supabase';
import { errorMessage } from '../src/lib/validation';
type Application = {
  id: string;
  created_at: string;
  profiles: ProfileNames & { student_id: string; class_name: string };
};
function Applications({ bilingual }: { bilingual: boolean }) {
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const [decline, setDecline] = useState<string | null>(null);
  const generation = useRef(0);
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const { busy, start, finish } = useBusy();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const { data, error } = await client()
        .from('membership_applications')
        .select(
          `id,created_at,profiles!membership_applications_user_id_fkey(display_name,student_id,class_name${bilingual ? ',name_zh,name_en' : ''})`,
        )
        .eq('status', 'pending')
        .order('created_at')
        .limit(30)
        .returns<Application[]>();
      if (error) throw error;
      if (requestId === generation.current) setRows(data ?? []);
    } catch (error) {
      if (requestId !== generation.current) return;
      setError(errorMessage(error));
      setRows([]);
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, [bilingual]);
  // Remote query loading state is synchronized with its network request.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const counter = generation;
    return () => {
      counter.current++;
    };
  }, [load]);
  const review = async (id: string, approve: boolean) => {
    if (!start()) return;
    setError('');
    try {
      const { error } = await client().rpc('review_membership', {
        p_application_id: id,
        p_approve: approve,
      });
      if (error) throw error;
      await load();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      finish();
    }
  };
  return (
    <>
      <ConfirmDialog
        visible={decline !== null}
        title={t('Decline application?')}
        message={t('The student can apply again after the waiting period.')}
        busy={busy}
        onCancel={() => setDecline(null)}
        onConfirm={() => {
          if (decline) void review(decline, false).then(() => setDecline(null));
        }}
      />
      {loading ? (
        <Loading />
      ) : (
        <>
          {Boolean(error) && <Notice error text={error} />}
          {rows.length === 0 && !error && (
            <Card>
              <SectionTitle icon="check">{t('All caught up')}</SectionTitle>
              <Body>{t('No applications are waiting for review.')}</Body>
            </Card>
          )}
          {rows.map((row) => (
            <Card
              key={row.id}
              style={
                width >= 1024
                  ? {
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 24,
                    }
                  : undefined
              }
            >
              <Badge label={t('Awaiting review')} />
              <Heading>{profileName(row.profiles, language)}</Heading>
              <Body>
                {row.profiles.student_id} · {row.profiles.class_name}
              </Body>
              <Body>
                {t('Applied')}{' '}
                {new Date(row.created_at).toLocaleDateString('en-MY', {
                  timeZone: 'Asia/Kuala_Lumpur',
                })}
              </Body>
              <Button
                icon="check"
                title={t('Approve membership')}
                busy={busy}
                onPress={() => void review(row.id, true)}
              />
              <Button
                title={t('Decline application')}
                variant="secondary"
                busy={busy}
                onPress={() => setDecline(row.id)}
              />
            </Card>
          ))}
          <Button
            title={t('Refresh applications')}
            variant="secondary"
            busy={busy}
            onPress={() => void load()}
          />
          <Body>
            {t(
              'Showing up to 30 oldest applications. Reviewed applications leave this queue.          ',
            )}
          </Body>
        </>
      )}
    </>
  );
}
export default function Administration() {
  const { t } = useLanguage();
  return (
    <Screen title={t('Administration')} subtitle={t('Membership applications')}>
      <Access admin>
        {(identity) => (
          <Applications bilingual={hasBilingualNames(identity.profile)} />
        )}
      </Access>
      <Button
        title={t('Back to home')}
        variant="secondary"
        onPress={() => router.replace('/(tabs)')}
      />
    </Screen>
  );
}
