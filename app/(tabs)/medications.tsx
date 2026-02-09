import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, FlatList, Alert, Image, DeviceEventEmitter } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { deleteMedication, generateSpeech } from '../../src/services/api';

interface Medication {
    id: string;
    name: string;
    dosage: string;
    frequency: number; // hours
    instructions?: string;
    quantity?: number;
    is_active: boolean;
    created_at: string;
    indication?: string; // Needed for TTS
    precaution?: string;
    monitoring_recommendation?: string;
    documents?: {
        storage_path: string;
    };
    storage_path: string;
}

// Sub-component to handle secure image loading
const MedicationIcon = ({ med, theme }: { med: Medication, theme: any }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadUserImage = async () => {
            if (med.documents?.storage_path) {
                const { data } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(med.documents.storage_path, 3600); // 1 hour expiry

                if (data?.signedUrl) {
                    setImageUrl(data.signedUrl);
                }
            }
        };
        loadUserImage();
    }, [med.documents?.storage_path]);

    if (imageUrl) {
        return (
            <View style={[styles.medIcon, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
                <Image
                    source={{ uri: imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
            </View>
        );
    }

    return (
        <View style={[styles.medIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="pill" size={24} color={theme.colors.primary} />
        </View>
    );
};

export default function MedicationsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const [medications, setMedications] = useState<Medication[]>([]);
    const [loading, setLoading] = useState(true);
    const currentSoundRef = useRef<any>(null); // Track currently playing sound
    const [playingMedId, setPlayingMedId] = useState<string | null>(null);

    const fetchMedications = useCallback(async () => {
        if (!user?.id) return;

        try {
            const { data, error } = await supabase
                .from('medications')
                .select('*, documents(storage_path)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMedications((data as any) || []);
        } catch (error) {
            console.error('Error fetching medications:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchMedications();
    }, [fetchMedications]);

    // Refetch when screen comes into focus to show fresh data
    useFocusEffect(
        useCallback(() => {
            fetchMedications();
            return () => {
                stopPlayback();
            };
        }, [fetchMedications])
    );

    // Listen for global stop speaking events
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('STOP_SPEAKING', () => {
            stopPlayback();
        });
        return () => {
            subscription.remove();
        };
    }, []);

    const handleDelete = (medId: string, medName: string) => {
        Alert.alert(
            'Delete Medication',
            `Are you sure you want to delete "${medName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const prevMeds = medications;
                        setMedications(m => m.filter(med => med.id !== medId));

                        try {
                            await deleteMedication(medId);
                        } catch (error) {
                            setMedications(prevMeds);
                            console.error('Delete error:', error);
                            Alert.alert('Error', 'Failed to delete medication');
                        }
                    },
                },
            ]
        );
    };

    const activeMeds = medications.filter(m => m.is_active);

    // Cleanup sounds on unmount
    useEffect(() => {
        return () => {
            if (currentSoundRef.current) {
                currentSoundRef.current.unloadAsync();
            }
        };
    }, []);

    const stopPlayback = async () => {
        if (currentSoundRef.current) {
            try {
                await currentSoundRef.current.stopAsync();
                await currentSoundRef.current.unloadAsync();
            } catch (e) {
                console.log('Error stopping sound:', e);
            }
            currentSoundRef.current = null;
        }
        setPlayingMedId(null);
    };

    const playMedicationInfo = async (med: Medication) => {
        try {
            // If this medication is already playing, stop it
            if (playingMedId === med.id) {
                await stopPlayback();
                return;
            }

            // Stop any currently playing audio
            await stopPlayback();

            setPlayingMedId(med.id);
            console.log('Starting TTS for:', med.name);
            const text = [
                med.name,
                med.indication ? `Indication: ${med.indication}` : '',
                med.instructions ? `Instructions: ${med.instructions}` : '',
                med.precaution ? `Precaution: ${med.precaution}` : '',
                med.monitoring_recommendation ? `Monitoring: ${med.monitoring_recommendation}` : ''
            ].filter(Boolean).join('. ');
            const { audioContent } = await generateSpeech(text);

            console.log('Got audio content, length:', audioContent.length);

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
            console.log('Sound created, playing...');
            await sound.playAsync();

            // Clear state when playback finishes
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    currentSoundRef.current = null;
                    setPlayingMedId(null);
                    sound.unloadAsync();
                }
            });
        } catch (error: any) {
            console.error('TTS Error:', error);
            setPlayingMedId(null);
            Alert.alert('Error', `Failed to play audio: ${error.message || JSON.stringify(error)}`);
        }
    };

    const renderMedicationItem = ({ item }: { item: Medication }) => (
        <Card
            style={styles.medCard}
            mode="elevated"
            onPress={() => router.push(`/medications/${item.id}`)}
        >
            <Card.Content style={styles.medCardContent}>
                <MedicationIcon med={item} theme={theme} />
                <View style={styles.medInfo}>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                        {item.name}
                    </Text>
                    {/* Optional: Show indication or brief summary text here too? User didn't ask, but it's good context. */}
                </View>
                <IconButton
                    icon={playingMedId === item.id ? 'stop' : 'volume-high'}
                    iconColor={playingMedId === item.id ? theme.colors.error : theme.colors.primary}
                    size={24}
                    onPress={(e) => {
                        e.stopPropagation();
                        playMedicationInfo(item);
                    }}
                />
            </Card.Content>
        </Card>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    size={24}
                    onPress={() => router.replace('/(tabs)')}
                />
                <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                    Medications
                </Text>
                <IconButton
                    icon="plus"
                    size={24}
                    onPress={() => router.push('/documents/upload')}
                />
                <IconButton
                    icon="calendar"
                    size={24}
                    onPress={() => router.push('/(tabs)/calendar')}
                />
            </View>

            <FlatList
                data={activeMeds}
                renderItem={renderMedicationItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="pill" size={64} color={theme.colors.outline} />
                            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: tokens.spacing.lg }}>
                                No Medications Uploaded
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: tokens.spacing.sm }}>
                                Upload a photo of your prescription label
                            </Text>
                            <Button
                                mode="contained"
                                style={{ marginTop: tokens.spacing.lg }}
                                onPress={() => router.push('/documents/upload')}
                            >
                                Upload
                            </Button>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: tokens.spacing.sm,
        paddingTop: tokens.spacing.sm,
    },
    listContent: {
        padding: tokens.spacing.lg,
        paddingBottom: 100,
    },
    medCard: {
        marginBottom: tokens.spacing.md,
        borderRadius: tokens.radius.md,
    },
    medCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.md,
    },
    medIcon: {
        width: 48,
        height: 48,
        borderRadius: tokens.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    medInfo: {
        flex: 1,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
        marginTop: tokens.spacing.xxl,
    },
});
