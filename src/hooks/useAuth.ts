import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
    const {
        session,
        user,
        isLoading,
        isInitialized,
        signInWithOtp,
        verifyOtp,
        signOut,
        deleteAccount,
        initialize,
        setDevSession,
    } = useAuthStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    return {
        session,
        user,
        isLoading,
        isInitialized,
        isAuthenticated: !!session,
        signInWithOtp,
        verifyOtp,
        signOut,
        deleteAccount,
        setDevSession,
    };
};
