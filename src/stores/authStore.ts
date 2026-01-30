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
        set({ isLoading: true });
        // Demo bypass
        if (phone === '+15550123456') {
            set({ isLoading: false });
            return { error: null };
        }
        if (!supabase) {
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

    initialize: async () => {
        if (get().isInitialized) return;

        if (!supabase) {
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
