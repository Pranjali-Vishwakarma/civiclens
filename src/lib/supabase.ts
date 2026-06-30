import { createBrowserClient, createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined in your environment.');
}

// 1. Direct/Browser Supabase Client instance (uses singleton/browser environment)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// 2. Browser Client Component client factory
export const createBrowserSupabaseClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

// 3. Server Component / Route Handler client (handling Next.js 16 async cookies)
export const createApiServerClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore cookie setting errors if called within Server Components where headers cannot be modified
          }
        },
      },
    }
  );
};

// 4. Supabase Service Role Client (for privileged backend tasks, bypasses RLS)
export const createSupabaseServiceClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('Missing Supabase service role key: SUPABASE_SERVICE_ROLE_KEY is not defined.');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
