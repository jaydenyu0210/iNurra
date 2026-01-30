import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        'Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
    );
}

export const supabase: SupabaseClient<Database> | null =
    supabaseUrl && supabaseAnonKey
        ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
              auth: {
                  storage: AsyncStorage,
                  autoRefreshToken: true,
                  persistSession: true,
                  detectSessionInUrl: false,
              },
          })
        : null;

// Helper to get current user ID
export const getCurrentUserId = async (): Promise<string | null> => {
    if (!supabase) {
        console.error('Supabase client not initialized');
        return null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
};

// Helper to get current session
export const getCurrentSession = async () => {
    if (!supabase) {
        console.error('Supabase client not initialized');
        return null;
    }
    const { data: { session } } = await supabase.auth.getSession();
    return session;
};
