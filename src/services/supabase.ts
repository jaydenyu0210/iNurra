import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Database } from '../types/database';

// Read from Constants.expoConfig.extra (for EAS builds) with fallback to process.env (for local dev)
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// #region agent log
fetch('http://127.0.0.1:7244/ingest/fe2ea001-4469-4caa-9eb0-c53bca250d82', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'supabase.ts:module-init', message: 'Supabase module loading', data: { supabaseUrlExists: !!supabaseUrl, supabaseUrlPrefix: supabaseUrl?.substring(0, 30), supabaseAnonKeyExists: !!supabaseAnonKey, supabaseAnonKeyLength: supabaseAnonKey?.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,C,D' }) }).catch(() => { });
// #endregion

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        'Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
    );
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/fe2ea001-4469-4caa-9eb0-c53bca250d82', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'supabase.ts:env-missing', message: 'ENV VARS MISSING', data: { supabaseUrl: supabaseUrl || 'UNDEFINED', supabaseAnonKey: supabaseAnonKey ? 'SET' : 'UNDEFINED' }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,D' }) }).catch(() => { });
    // #endregion
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
