// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's Clerk account. Auth is Clerk, not
// Supabase Auth — this function verifies the caller's Clerk session token and
// deletes them via the Clerk Backend API. Required for App Store review (Apple
// guideline 5.1.1(v): account-creating apps must offer in-app account deletion).
//
// Deploy:
//   supabase functions deploy delete-account
// Requires CLERK_SECRET_KEY set as a function secret:
//   supabase secrets set CLERK_SECRET_KEY=sk_...
//
// The client calls it via `supabase.functions.invoke('delete-account', { headers: { Authorization } })`,
// passing the signed-in user's Clerk session token explicitly (Supabase's own
// auto-attached Authorization header is for Supabase Auth, which this app doesn't use).

import { createClerkClient, verifyToken } from 'https://esm.sh/@clerk/backend@1';

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
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Missing authorization header' }, 401);

  const secretKey = Deno.env.get('CLERK_SECRET_KEY');
  if (!secretKey) return json({ error: 'Server misconfigured' }, 500);

  // Identify the caller from their own verified session token (never trust a
  // user id from the request body).
  const token = authHeader.slice('Bearer '.length);
  let userId: string;
  try {
    const claims = await verifyToken(token, { secretKey });
    userId = claims.sub;
  } catch {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const clerk = createClerkClient({ secretKey });
  try {
    await clerk.users.deleteUser(userId);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Delete failed' }, 500);
  }

  return json({ ok: true }, 200);
});
