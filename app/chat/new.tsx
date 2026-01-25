import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/services/supabase';

export default function NewChat() {
    const { documentId } = useLocalSearchParams<{ documentId: string }>();
    const docParam = documentId ? `?documentId=${documentId}` : '';

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getOrCreateSession() {
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    // No user, create temporary session
                    setSessionId(`new-${Date.now()}`);
                    setLoading(false);
                    return;
                }

                // Try to find user's most recent chat session
                const { data: existingSessions, error } = await supabase
                    .from('chat_sessions')
                    .select('id')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false })
                    .limit(1);

                if (error) {
                    console.error('Error fetching sessions:', error);
                    setSessionId(`new-${Date.now()}`);
                    setLoading(false);
                    return;
                }

                if (existingSessions && existingSessions.length > 0) {
                    // Resume most recent session
                    const latestSession = existingSessions[0] as { id: string };
                    setSessionId(latestSession.id);
                } else {
                    // No existing sessions, create new one
                    setSessionId(`new-${Date.now()}`);
                }
            } catch (err) {
                console.error('Error in getOrCreateSession:', err);
                setSessionId(`new-${Date.now()}`);
            } finally {
                setLoading(false);
            }
        }

        getOrCreateSession();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return <Redirect href={`/chat/${sessionId}${docParam}`} />;
}
