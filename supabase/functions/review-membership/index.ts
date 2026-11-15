import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { createHandler } from './handler.ts';

Deno.serve(
  createHandler((token) => {
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      },
    );
    return {
      async authenticate() {
        const { data, error } = await client.auth.getUser(token);
        return !error && Boolean(data.user);
      },
      async review(applicationId, approve) {
        const { error } = await client.rpc('review_membership', {
          p_application_id: applicationId,
          p_approve: approve,
        });
        return error;
      },
    };
  }),
);
