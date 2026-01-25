import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { deleteMedication } from '../../src/services/api';

const { width } = Dimensions.get('window');

interface Medication {
    id: string;
    name: string;
    dosage: string;
    frequency: number;
    instructions?: string;
    quantity?: number;
    start_date?: string;
    end_date?: string;
    duration_days?: number;
    document_id?: string;
    created_at: string;
}

export default function MedicationDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();

    const [medication, setMedication] = useState<Medication | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMedication() {
            if (!id || !user?.id) {
                setError('Medication not found');
                setLoading(false);
                return;
            }

            try {
                // Fetch medication
                const { data: med, error: medError } = await supabase
                    .from('medications')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (medError) throw medError;
                if (!med) {
                    setError('Medication not found');
                    setLoading(false);
                    return;
                }

                setMedication(med as any);

                // Fetch document and get image if document_id exists
                if (med.document_id) {
                    const { data: doc, error: docError } = await supabase
                        .from('documents')
                        .select('storage_path')
                        .eq('id', med.document_id)
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
                console.error('Error fetching medication:', err);
                setError('Failed to load medication');
            } finally {
                setLoading(false);
            }
        }

        fetchMedication();
    }, [id, user?.id]);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Not set';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleDelete = () => {
        if (!medication) return;
        
        Alert.alert(
            'Delete Medication',
            `Are you sure you want to delete "${medication.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteMedication(medication.id);
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete medication');
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

    if (error || !medication) {
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
                        {error || 'Medication not found'}
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
                    {medication.name}
                </Text>
                <IconButton
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    size={24}
                    onPress={handleDelete}
                />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Medication Image */}
                {imageUrl && (
                    <Card style={styles.imageCard} mode="elevated">
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.medicationImage}
                            resizeMode="contain"
                        />
                    </Card>
                )}

                {/* Medication Details */}
                <Card style={styles.detailsCard} mode="elevated">
                    <Card.Content>
                        <View style={styles.detailRow}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Name
                            </Text>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                {medication.name}
                            </Text>
                        </View>

                        {medication.dosage && (
                            <View style={styles.detailRow}>
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Dosage
                                </Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                    {medication.dosage}
                                </Text>
                            </View>
                        )}

                        {medication.frequency && (
                            <View style={styles.detailRow}>
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Frequency
                                </Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                    Every {medication.frequency} hours
                                </Text>
                            </View>
                        )}

                        {medication.quantity && (
                            <View style={styles.detailRow}>
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Quantity
                                </Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                    {medication.quantity}
                                </Text>
                            </View>
                        )}

                        {medication.duration_days && (
                            <View style={styles.detailRow}>
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Duration
                                </Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                    {medication.duration_days} days
                                </Text>
                            </View>
                        )}

                        {medication.start_date && (
                            <View style={styles.detailRow}>
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Start Date
                                </Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                    {formatDate(medication.start_date)}
                                </Text>
                            </View>
                        )}

                        {medication.end_date && (
                            <View style={styles.detailRow}>
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    End Date
                                </Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                    {formatDate(medication.end_date)}
                                </Text>
                            </View>
                        )}

                        {medication.instructions && (
                            <View style={styles.detailRow}>
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Instructions
                                </Text>
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                    {medication.instructions}
                                </Text>
                            </View>
                        )}

                        <View style={styles.detailRow}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Added
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                {formatDate(medication.created_at)}
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
    medicationImage: {
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

