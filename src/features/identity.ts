import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { client } from '../lib/supabase';
import { errorMessage } from '../lib/validation';
import { useSession } from './session';
export type Profile = {
  id: string;
  student_id: string;
  avatar_id?: string | null;
  display_name: string;
  name_zh?: string | null;
  name_en?: string | null;
  class_name: string;
  status: 'active' | 'suspended';
};
export type Identity = {
  profile: Profile;
  role: 'member' | 'admin' | 'super_admin';
  member: boolean;
  office?: string | null;
  clubLogo?: string | null;
  logoOwner?: string | null;
  clubName: string;
  application: 'pending' | 'approved' | 'rejected' | null;
};
export function useIdentity() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!userId) {
      setIdentity(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const db = client();
      const results = await Promise.all([
        db.from('profiles').select('*').eq('id', userId).single(),
        db.from('platform_roles').select('*').eq('user_id', userId).single(),
        db
          .from('memberships')
          .select('status')
          .eq('user_id', userId)
          .maybeSingle(),
        db.from('club_settings').select('*').maybeSingle(),
        db
          .from('membership_applications')
          .select('status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      for (const result of results) if (result.error) throw result.error;
      const [profile, role, membership, club, application] = results;
      if (current === generation.current)
        setIdentity({
          profile: profile!.data as Profile,
          role: role!.data!.role,
          office: role!.data!.office,
          clubLogo: club!.data?.logo_id,
          logoOwner: club!.data?.logo_owner,
          member: membership!.data?.status === 'active',
          clubName: club!.data?.name ?? 'MicroHub',
          application: application!.data?.status ?? null,
        });
    } catch (error) {
      if (current === generation.current) {
        setError(errorMessage(error));
        setIdentity(null);
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      const counter = generation;
      return () => {
        counter.current++;
      };
    }, [reload]),
  );
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => listener.remove();
  }, [reload]);
  const visibleIdentity = identity?.profile.id === userId ? identity : null;
  return { identity: visibleIdentity, loading, error, reload };
}

export function officeLabel(office?: string | null) {
  return office === 'president'
    ? 'President'
    : office === 'vice_president'
      ? 'Vice President'
      : 'teach';
}
