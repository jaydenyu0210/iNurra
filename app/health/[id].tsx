import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { deleteHealthMetric } from '../../src/services/api';

const { width } = Dimensions.get('window');

interface HealthMetric {
    id: string;
    metric_type: string;
    value: number;
    unit: string;
    recorded_at: string;
    source_document_id?: string;
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
                        <View style={styles.detailRow}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Metric Type
                            </Text>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                {metric.metric_type}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Value
                            </Text>
                            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                {metric.value} {metric.unit}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Recorded At
                            </Text>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                {format(new Date(metric.recorded_at), 'MMM d, yyyy h:mm a')}
                            </Text>
                        </View>
                    </Card.Content>
                </Card>
            </ScrollView>
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

