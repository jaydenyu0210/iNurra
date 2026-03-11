import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

// Fixed dev user ID for testing
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

interface AuthState {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    isInitialized: boolean;

    // Actions
    setSession: (session: Session | null) => void;
    setDevSession: () => Promise<void>;
    signInWithOtp: (phone: string) => Promise<{ error: Error | null }>;
    verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<{ error: Error | null }>;
    initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    session: null,
    user: null,
    isLoading: false,
    isInitialized: false,

    setSession: (session) => {
        set({
            session,
            user: session?.user ?? null,
        });
    },

    setDevSession: async () => {
        // Simple mock user for development
        // RLS should be disabled for dev mode - run 008_disable_rls_dev.sql
        console.log('Setting up dev session with mock user...');
        const mockUser = {
            id: DEV_USER_ID,
            phone: '+15550000001',
            role: 'authenticated',
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        } as User;

        const mockSession = {
            access_token: 'dev-token',
            token_type: 'bearer',
            expires_in: 86400,
            refresh_token: 'dev-refresh',
            user: mockUser,
        } as Session;

        set({
            session: mockSession,
            user: mockUser,
        });
        console.log('Dev session set with user ID:', DEV_USER_ID);
    },

    signInWithOtp: async (phone: string) => {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/fe2ea001-4469-4caa-9eb0-c53bca250d82', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'authStore.ts:signInWithOtp', message: 'signInWithOtp called', data: { phone: phone?.substring(0, 6) + '***', supabaseExists: !!supabase, isInitialized: get().isInitialized }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,C,E' }) }).catch(() => { });
        // #endregion
        set({ isLoading: true });
        // Demo bypass
        if (phone === '+15550123456') {
            set({ isLoading: false });
            return { error: null };
        }
        if (!supabase) {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/fe2ea001-4469-4caa-9eb0-c53bca250d82', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'authStore.ts:signInWithOtp-null', message: 'ERROR: supabase is null', data: { phone: phone?.substring(0, 6) + '***' }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,C' }) }).catch(() => { });
            // #endregion
            set({ isLoading: false });
            return { error: new Error('Supabase client not initialized') };
        }
        try {
            const { error } = await supabase.auth.signInWithOtp({
                phone,
            });
            if (error) throw error;
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        } finally {
            set({ isLoading: false });
        }
    },

    verifyOtp: async (phone: string, token: string) => {
        set({ isLoading: true });
        // Demo bypass
        if (phone === '+15550123456' && token === '123456') {
            const mockUser = {
                id: '00000000-0000-0000-0000-000000000002', // Valid UUID for demo user
                phone: '+15550123456',
                role: 'authenticated',
                aud: 'authenticated',
                created_at: new Date().toISOString(),
            } as User;

            const mockSession = {
                access_token: 'demo-token',
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: 'demo-refresh',
                user: mockUser,
            } as Session;

            set({
                session: mockSession,
                user: mockUser,
            });
            set({ isLoading: false });
            return { error: null };
        }

        if (!supabase) {
            set({ isLoading: false });
            return { error: new Error('Supabase client not initialized') };
        }

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                phone,
                token,
                type: 'sms',
            });
            if (error) throw error;
            set({
                session: data.session,
                user: data.user,
            });
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        } finally {
            set({ isLoading: false });
        }
    },

    signOut: async () => {
        set({ isLoading: true });
        try {
            if (supabase) {
                await supabase.auth.signOut();
            }
            set({ session: null, user: null });
        } finally {
            set({ isLoading: false });
        }
    },

    deleteAccount: async () => {
        console.log('[deleteAccount] === START ===');
        if (!supabase) {
            return { error: new Error('Supabase client not initialized') };
        }

        const currentSession = get().session;
        const isDevToken = currentSession?.access_token === 'dev-token' || currentSession?.access_token === 'demo-token';
        console.log('[deleteAccount] isDevToken:', isDevToken, 'storeToken:', currentSession?.access_token?.substring(0, 15) + '...');

        // Get the freshest possible access token
        let accessToken: string | undefined;

        if (isDevToken) {
            console.log('[deleteAccount] Dev token detected, skipping session refresh');
            accessToken = currentSession?.access_token;
        } else {
            // First try getSession (returns cached/persisted session from Supabase client)
            const { data: sessionResult } = await supabase.auth.getSession();
            console.log('[deleteAccount] getSession result:', sessionResult?.session ? 'has session' : 'no session');

            if (sessionResult?.session) {
                accessToken = sessionResult.session.access_token;
                console.log('[deleteAccount] Using token from getSession:', accessToken?.substring(0, 15) + '...');
            }

            // If no session from getSession, try refreshSession
            if (!accessToken) {
                console.log('[deleteAccount] No token from getSession, trying refreshSession...');
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                console.log('[deleteAccount] refreshSession result:', refreshError ? 'ERROR: ' + refreshError.message : refreshData?.session ? 'has session' : 'no session');

                if (refreshError) {
                    console.error('[deleteAccount] refreshSession failed:', refreshError.message);
                    return { error: new Error('Session expired. Please log in again and retry. Error: ' + refreshError.message) };
                }

                if (refreshData?.session) {
                    accessToken = refreshData.session.access_token;
                    set({ session: refreshData.session, user: refreshData.user });
                    console.log('[deleteAccount] Using token from refreshSession:', accessToken?.substring(0, 15) + '...');
                }
            }
        }

        if (!accessToken) {
            console.error('[deleteAccount] No access token available after all attempts');
            return { error: new Error('No access token available. Please log in again.') };
        }

        set({ isLoading: true });
        try {
            // Use raw fetch instead of supabase.functions.invoke to ensure
            // correct Authorization header (the Supabase client may override it)
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
            const functionUrl = `${supabaseUrl}/functions/v1/delete-account`;

            console.log('[deleteAccount] Calling:', functionUrl);
            console.log('[deleteAccount] Token prefix:', accessToken.substring(0, 20) + '...');

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ confirm: true }),
            });

            const responseText = await response.text();
            console.log('[deleteAccount] Status:', response.status, 'Body:', responseText);

            if (!response.ok) {
                let message = `Delete failed (${response.status})`;
                try {
                    const body = JSON.parse(responseText);
                    message = body?.error || body?.message || message;
                } catch {
                    message = responseText || message;
                }
                console.error('[deleteAccount] Function returned error:', message);
                throw new Error(message);
            }

            const data = JSON.parse(responseText);
            if (data?.error) throw new Error(data.error);

            console.log('[deleteAccount] SUCCESS - account deleted on server');
            // Sign out locally
            try {
                await supabase.auth.signOut();
            } catch (_) { }
            set({ session: null, user: null });
            return { error: null };
        } catch (error) {
            console.error('[deleteAccount] Error:', error);
            return { error: error as Error };
        } finally {
            set({ isLoading: false });
        }
    },

    initialize: async () => {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/fe2ea001-4469-4caa-9eb0-c53bca250d82', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'authStore.ts:initialize', message: 'Auth initialize called', data: { alreadyInitialized: get().isInitialized, supabaseExists: !!supabase }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C,E' }) }).catch(() => { });
        // #endregion
        if (get().isInitialized) return;

        if (!supabase) {
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/fe2ea001-4469-4caa-9eb0-c53bca250d82', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'authStore.ts:initialize-null', message: 'ERROR: supabase null during initialize', data: {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,C' }) }).catch(() => { });
            // #endregion
            console.error('Supabase client not initialized');
            set({ isInitialized: true });
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            set({
                session,
                user: session?.user ?? null,
                isInitialized: true,
            });

            // Listen for auth changes
            supabase.auth.onAuthStateChange((_event, session) => {
                set({
                    session,
                    user: session?.user ?? null,
                });
            });
        } catch (error) {
            console.error('Failed to initialize auth:', error);
            set({ isInitialized: true });
        }
    },
}));
