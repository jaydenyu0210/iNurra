import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, useTheme, IconButton, Chip, Portal, Dialog, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Audio } from 'expo-av';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { deleteHealthMetric, generateSpeech } from '../../src/services/api';

const { width } = Dimensions.get('window');

interface HealthMetric {
    id: string;
    metric_type: string;
    value: number;
    unit: string;
    recorded_at: string;
    source_document_id?: string;
    normal_range_lower?: number;
    normal_range_upper?: number;
    measurement_precautions?: string;
    monitoring_guidance?: string;
}

export default function HealthMetricDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();

    const [metric, setMetric] = useState<HealthMetric | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const currentSoundRef = useRef<Audio.Sound | null>(null);
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        async function fetchMetric() {
            if (!id || !user?.id) {
                setError('Health metric not found');
                setLoading(false);
                return;
            }

            try {
                // Fetch health metric
                const { data: healthMetric, error: metricError } = await supabase
                    .from('health_metrics')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (metricError) throw metricError;
                if (!healthMetric) {
                    setError('Health metric not found');
                    setLoading(false);
                    return;
                }

                setMetric(healthMetric as any);

                // Fetch document and get image if source_document_id exists
                if (healthMetric.source_document_id) {
                    const { data: doc, error: docError } = await supabase
                        .from('documents')
                        .select('storage_path')
                        .eq('id', healthMetric.source_document_id)
                        .single();

                    if (!docError && doc?.storage_path) {
                        const { data: urlData } = await supabase.storage
                            .from('documents')
                            .createSignedUrl(doc.storage_path, 3600);

                        if (urlData?.signedUrl) {
                            setImageUrl(urlData.signedUrl);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching health metric:', err);
                setError('Failed to load health metric');
            } finally {
                setLoading(false);
            }
        }

        fetchMetric();
    }, [id, user?.id]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (currentSoundRef.current) {
                currentSoundRef.current.unloadAsync();
            }
        };
    }, []);

    const stopSpeaking = async () => {
        if (currentSoundRef.current) {
            try {
                await currentSoundRef.current.stopAsync();
                await currentSoundRef.current.unloadAsync();
            } catch (e) {
                console.log('Error stopping sound:', e);
            }
            currentSoundRef.current = null;
        }
        setIsSpeaking(false);
    };

    const speakMetricDetails = async () => {
        if (!metric) return;

        if (isSpeaking) {
            await stopSpeaking();
            return;
        }

        try {
            await stopSpeaking();
            setIsSpeaking(true);

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            const rangeStatus = calculateRangeStatus(metric.value, metric.normal_range_lower, metric.normal_range_upper);
            let statusText = '';
            if (rangeStatus === 'normal') statusText = 'is within normal range';
            if (rangeStatus === 'high') statusText = 'is higher than normal';
            if (rangeStatus === 'low') statusText = 'is lower than normal';

            const textToSpeak = [
                `Name: ${metric.metric_type}`,
                `Measured value: ${metric.value} ${metric.unit}`,
                metric.measurement_precautions ? `Precautions: ${metric.measurement_precautions}` : '',
                metric.monitoring_guidance ? `Monitoring Guidance: ${metric.monitoring_guidance}` : '',
                (metric.normal_range_lower || metric.normal_range_upper) ? `Normal Range: ${metric.normal_range_lower || '?'} to ${metric.normal_range_upper || '?'}` : '',
                statusText ? `Range Status: ${statusText}` : ''
            ].filter(Boolean).join('. ');

            const { audioContent } = await generateSpeech(textToSpeak);
            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/mp3;base64,${audioContent}` },
                { shouldPlay: true }
            );

            currentSoundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    currentSoundRef.current = null;
                    setIsSpeaking(false);
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            console.error('TTS Error:', error);
            setIsSpeaking(false);
            Alert.alert('Error', 'Failed to play audio');
        }
    };

    const calculateRangeStatus = (value: number, lower?: number, upper?: number) => {
        if (typeof value !== 'number' || isNaN(value)) return null;
        if (lower === undefined && upper === undefined) return null;
        if (lower === null && upper === null) return null;

        if (lower !== undefined && lower !== null && value < lower) return 'low';
        if (upper !== undefined && upper !== null && value > upper) return 'high';
        return 'normal';
    };

    const handleDelete = () => {
        if (!metric) return;

        Alert.alert(
            'Delete Health Metric',
            `Are you sure you want to delete this ${metric.metric_type} reading?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteHealthMetric(metric.id);
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete health metric');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.header}>
                    <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                    <Text variant="titleLarge" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                        Loading...
                    </Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !metric) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.header}>
                    <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                    <Text variant="titleLarge" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                        Error
                    </Text>
                </View>
                <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="alert-circle" size={64} color={theme.colors.error} />
                    <Text variant="titleMedium" style={{ color: theme.colors.error, marginTop: tokens.spacing.md }}>
                        {error || 'Health metric not found'}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const rangeStatus = calculateRangeStatus(metric.value, metric.normal_range_lower, metric.normal_range_upper);

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
                    {metric.metric_type}
                </Text>
                <IconButton
                    icon="pencil-outline"
                    size={24}
                    onPress={() => {
                        setEditValue(metric.value.toString());
                        setEditDialogVisible(true);
                    }}
                />
                <IconButton
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    size={24}
                    onPress={handleDelete}
                />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Health Metric Image */}
                {imageUrl && (
                    <Card style={styles.imageCard} mode="elevated">
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.metricImage}
                            resizeMode="contain"
                        />
                    </Card>
                )}

                {/* Health Metric Details */}
                <Card style={styles.detailsCard} mode="elevated">
                    <Card.Content>
                        {/* Value and Status */}
                        <View style={styles.detailRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Value</Text>
                                {rangeStatus && (
                                    <Chip style={{ backgroundColor: rangeStatus === 'normal' ? '#4CAF5020' : '#FF980020', marginLeft: 12 }}>
                                        <Text style={{ color: rangeStatus === 'normal' ? '#4CAF50' : '#FF9800', fontWeight: 'bold' }}>
                                            {rangeStatus === 'normal' ? 'Normal' : (rangeStatus === 'high' ? 'High' : 'Low')}
                                        </Text>
                                    </Chip>
                                )}
                            </View>
                            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                {metric.value} {metric.unit}
                            </Text>
                        </View>

                        {/* Normal Range */}
                        {(metric.normal_range_lower || metric.normal_range_upper) && (
                            <View style={styles.detailRow}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Normal Range</Text>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                                    {metric.normal_range_lower || '?'} - {metric.normal_range_upper || '?'} {metric.unit}
                                </Text>
                            </View>
                        )}

                        {/* Precautions */}
                        <View style={styles.detailRow}>
                            <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Precautions</Text>
                            {(() => {
                                const text = metric.measurement_precautions || 'Not available';
                                const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                if (sentences.length <= 1) {
                                    return <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{text}</Text>;
                                }
                                return (
                                    <View>
                                        {sentences.map((s: string, i: number) => (
                                            <Text key={i} variant="bodyMedium" style={{ color: theme.colors.onSurface, marginBottom: 2 }}>• {s.trim()}</Text>
                                        ))}
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Monitoring Guidance */}
                        <View style={styles.detailRow}>
                            <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Monitoring Guidance</Text>
                            {(() => {
                                const text = metric.monitoring_guidance || 'Not available';
                                const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                if (sentences.length <= 1) {
                                    return <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{text}</Text>;
                                }
                                return (
                                    <View>
                                        {sentences.map((s: string, i: number) => (
                                            <Text key={i} variant="bodyMedium" style={{ color: theme.colors.onSurface, marginBottom: 2 }}>• {s.trim()}</Text>
                                        ))}
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Recorded At */}
                        <View style={styles.detailRow}>
                            <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Recorded At</Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                                {format(new Date(metric.recorded_at), 'MMM d, yyyy h:mm a')}
                            </Text>
                        </View>
                    </Card.Content>
                </Card>
            </ScrollView>

            {/* Edit Dialog */}
            <Portal>
                <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
                    <Dialog.Title>Edit Measurement</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label={`Value (${metric.unit})`}
                            value={editValue}
                            onChangeText={setEditValue}
                            mode="outlined"
                            keyboardType="numeric"
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
                        <Button onPress={async () => {
                            try {
                                const newValue = parseFloat(editValue);
                                if (isNaN(newValue)) {
                                    Alert.alert('Error', 'Please enter a valid number');
                                    return;
                                }
                                const { error: updateError } = await supabase!
                                    .from('health_metrics')
                                    .update({ value: newValue })
                                    .eq('id', metric.id);
                                if (updateError) throw updateError;
                                setMetric({ ...metric, value: newValue });
                                setEditDialogVisible(false);
                            } catch (err) {
                                Alert.alert('Error', 'Failed to update measurement');
                            }
                        }}>Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: tokens.spacing.lg,
        paddingBottom: tokens.spacing.xxl,
    },
    imageCard: {
        marginBottom: tokens.spacing.lg,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
    },
    metricImage: {
        width: '100%',
        height: width * 0.8,
        backgroundColor: '#f0f0f0',
    },
    detailsCard: {
        borderRadius: tokens.radius.lg,
        marginBottom: tokens.spacing.lg,
    },
    detailRow: {
        marginBottom: tokens.spacing.md,
    },
});
