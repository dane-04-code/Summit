// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's auth account. The app cannot do this
// with the anon key (it needs the service role), so deletion goes through this
// function. Required for App Store review (Apple guideline 5.1.1(v):
// account-creating apps must offer in-app account deletion).
//
// Deploy:
//   supabase functions deploy delete-account
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are injected
// by the platform — no extra secrets to set.
//
// The client calls it via `supabase.functions.invoke('delete-account')`, which
// forwards the signed-in user's JWT in the Authorization header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  // Identify the caller from their own JWT (never trust a user id from the body).
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Invalid or expired session' }, 401);

  // Delete with service-role privileges.
  const admin = createClient(url, serviceKey);
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true }, 200);
});
