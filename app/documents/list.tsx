import { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, DeviceEventEmitter, Image } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, ActivityIndicator, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { tokens } from '../../src/theme';
import { useAuth } from '../../src/hooks';
import { supabase } from '../../src/services/supabase';
import { generateSpeech } from '../../src/services/api';

interface Document {
    id: string;
    type: string;
    content_labels?: string[];
    file_name: string;
    title?: string;
    summary?: string;
    created_at: string;
    storage_path?: string;
}

// Sub-component to handle secure image loading for documents
const DocumentIcon = ({ doc, theme }: { doc: Document, theme: any }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadImage = async () => {
            if (doc.storage_path) {
                const { data } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry
                if (data?.signedUrl) {
                    setImageUrl(data.signedUrl);
                }
            }
        };
        loadImage();
    }, [doc.storage_path]);

    if (imageUrl) {
        return (
            <View style={[styles.iconBox, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
                <Image
                    source={{ uri: imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
            </View>
        );
    }

    return (
        <View style={[styles.iconBox, { backgroundColor: theme.colors.secondaryContainer }]}>
            <MaterialCommunityIcons name="file-document" size={24} color={theme.colors.secondary} />
        </View>
    );
};

export default function DocumentsListScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<Document[]>([]);
    const currentSoundRef = useRef<Audio.Sound | null>(null);
    const [playingDocId, setPlayingDocId] = useState<string | null>(null);

    const fetchDocuments = useCallback(async () => {
        if (!user?.id) return;
        if (!supabase) return;

        try {
            // Fetch all documents first
            const { data: docs, error } = await supabase
                .from('documents')
                .select('id, type, content_labels, file_name, title, summary, created_at, storage_path')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter to only show documents with medical_document label
            setDocuments((docs || []).filter(d => d.content_labels?.includes('medical_document')));
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Stop speaking when screen loses focus
    useFocusEffect(
        useCallback(() => {
            return () => {
                stopPlayback();
            };
        }, [])
    );

    // Listen for global stop speaking events (e.g., when Ask Nurra button is pressed)
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('STOP_SPEAKING', () => {
            stopPlayback();
        });
        return () => {
            subscription.remove();
        };
    }, []);

    // Cleanup sounds on unmount
    useEffect(() => {
        return () => {
            if (currentSoundRef.current) {
                currentSoundRef.current.unloadAsync();
            }
        };
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDocuments();
        setRefreshing(false);
    };

    // Stop any currently playing audio
    const stopPlayback = async () => {
        if (currentSoundRef.current) {
            try {
                await currentSoundRef.current.stopAsync();
                await currentSoundRef.current.unloadAsync();
            } catch (e) {
                // Ignore errors during cleanup
            }
            currentSoundRef.current = null;
        }
        setPlayingDocId(null);
    };

    // Speak document title and summary
    const speakDocumentInfo = async (doc: Document) => {
        // If already playing this doc, stop it
        if (playingDocId === doc.id) {
            await stopPlayback();
            return;
        }

        try {
            // Stop any currently playing audio
            await stopPlayback();

            setPlayingDocId(doc.id);
            
            // Build text to speak: title and summary
            const textParts = [
                doc.title || doc.file_name,
                doc.summary ? `Summary: ${doc.summary}` : ''
            ].filter(Boolean);
            const text = textParts.join('. ');

            const { audioContent } = await generateSpeech(text);

            // Configure audio mode to ensure playback works (even in silent mode)
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/mp3;base64,${audioContent}` },
                { shouldPlay: true }
            );

            currentSoundRef.current = sound;
            await sound.playAsync();

            // Clear state when playback finishes
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    currentSoundRef.current = null;
                    setPlayingDocId(null);
                    sound.unloadAsync();
                }
            });
        } catch (error: any) {
            console.error('TTS Error:', error);
            setPlayingDocId(null);
            Alert.alert('Error', `Failed to play audio: ${error.message || JSON.stringify(error)}`);
        }
    };

    const getDocTypeIcon = (type: string, labels?: string[]) => {
        // Use primary type first
        switch (type) {
            case 'prescription': return 'pill';
            case 'test_result': return 'test-tube';
            case 'doctor_notes': return 'file-document';
            case 'discharge_summary': return 'hospital-building';
            case 'health_metrics': return 'heart-pulse';
            case 'body_condition': return 'alert-circle';
            case 'bodily_excretion': return 'water';
            case 'todo_activity': return 'checkbox-marked-circle-outline';
        }

        // Fallback to checking labels if type is generic or matches specific conditions
        if (labels?.includes('prescription')) return 'pill';
        if (labels?.includes('health_metrics')) return 'heart-pulse';

        return 'file';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    size={24}
                    onPress={() => router.back()}
                />
                <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                    Documents
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" style={{ marginTop: 40 }} />
                ) : documents.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="file-document-outline" size={64} color={theme.colors.outline} />
                        <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
                            No documents found
                        </Text>
                        <Button mode="contained" onPress={() => router.push('/documents/upload')} style={{ marginTop: 16 }}>
                            Upload First Document
                        </Button>
                    </View>
                ) : (
                    documents.map((doc) => (
                        <Card key={doc.id} style={styles.card} mode="elevated" onPress={() => router.push(`/documents/${doc.id}`)}>
                            <Card.Content style={styles.cardContent}>
                                <DocumentIcon doc={doc} theme={theme} />
                                <View style={styles.info}>
                                    <Text variant="titleMedium" numberOfLines={1}>
                                        {doc.title || doc.file_name}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {formatDate(doc.created_at)}
                                    </Text>
                                </View>
                                <IconButton
                                    icon={playingDocId === doc.id ? 'stop' : 'volume-high'}
                                    iconColor={playingDocId === doc.id ? theme.colors.error : theme.colors.primary}
                                    size={20}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        speakDocumentInfo(doc);
                                    }}
                                />
                            </Card.Content>
                        </Card>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.sm, paddingTop: tokens.spacing.sm },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { marginBottom: 12, borderRadius: 12 },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    info: { flex: 1 },
    emptyState: { alignItems: 'center', marginTop: 60 },
});
