import { supabase } from '@/lib/supabase';

describe('supabase client', () => {
  it('exports a client with auth', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
  });
});
