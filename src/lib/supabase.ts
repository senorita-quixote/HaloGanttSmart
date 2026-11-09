import { createClient } from '@supabase/supabase-js';
import { isLocalMode } from '@/lib/localMode';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!isLocalMode && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

// In local mode without Supabase configured, use a placeholder client. There is never
// a signed-in session, so planning-history calls return early and nothing is sent.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'local-mode-placeholder',
  {
    auth: {
      storage: sessionStorage,
      storageKey: 'ganttsmart-auth',
      flowType: 'pkce',
    },
  },
);
