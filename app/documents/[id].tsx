import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, Button, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { deleteDocument } from '../../src/services/api';

const { width } = Dimensions.get('window');

interface Document {
    id: string;
    user_id: string;
    type: string;
    file_name: string;
    storage_path: string;
    title?: string;
    summary?: string;
    extracted_text?: string;
    created_at: string;
}

interface Medication {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    instructions?: string;
}

interface HealthMetric {
    id: string;
    metric_type: string;
    value: number;
    unit: string;
}

export default function DocumentDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();

    const [document, setDocument] = useState<Document | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [metrics, setMetrics] = useState<HealthMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDocument() {
            if (!id || !user?.id) {
                setError('Document not found');
                setLoading(false);
                return;
            }

            try {
                // Fetch document
                const { data: rawDoc, error: docError } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('id', id)
                    .single();

                const doc = rawDoc as any;

                if (docError) throw docError;
                if (!doc) {
                    setError('Document not found');
                    setLoading(false);
                    return;
                }

                setDocument(doc);

                // Get signed URL for image
                if (doc.storage_path) {
                    const { data: urlData } = await supabase.storage
                        .from('documents')
                        .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry

                    if (urlData?.signedUrl) {
                        setImageUrl(urlData.signedUrl);
                    }
                }

                // Fetch related medications
                const { data: meds } = await supabase
                    .from('medications')
                    .select('id, name, dosage, frequency, instructions')
                    .eq('source_document_id', id);

                setMedications(meds || []);

                // Fetch related health metrics
                const { data: healthMetrics } = await supabase
                    .from('health_metrics')
                    .select('id, metric_type, value, unit')
                    .eq('source_document_id', id);

                setMetrics(healthMetrics || []);

            } catch (err) {
                console.error('Error fetching document:', err);
                setError('Failed to load document');
            } finally {
                setLoading(false);
            }
        }

        fetchDocument();
    }, [id, user?.id]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleDelete = () => {
        if (!document) return;
        
        Alert.alert(
            'Delete Document',
            `Are you sure you want to delete "${document.title || document.file_name}"? This will also remove any extracted data.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDocument(document.id);
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete document');
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

    if (error || !document) {
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
                        {error || 'Document not found'}
                    </Text>
                    <Button mode="contained" onPress={() => router.back()} style={{ marginTop: tokens.spacing.lg }}>
                        Go Back
                    </Button>
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
                <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {document.title || document.file_name || 'Document'}
                </Text>
                <IconButton
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    size={24}
                    onPress={handleDelete}
                />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Document Image */}
                {imageUrl && (
                    <Card style={styles.imageCard} mode="elevated">
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.documentImage}
                            resizeMode="contain"
                        />
                    </Card>
                )}

                {/* Summary Card */}
                <Card style={styles.summaryCard} mode="elevated">
                    <Card.Content>
                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: tokens.spacing.sm }}>
                            Summary
                        </Text>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>
                            {document.summary || 'No summary available for this document.'}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.outline, marginTop: tokens.spacing.md }}>
                            Uploaded: {formatDate(document.created_at)}
                        </Text>
                    </Card.Content>
                </Card>

                {/* Extracted Medications */}
                {medications.length > 0 && (
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                            Extracted Medications ({medications.length})
                        </Text>
                        {medications.map((med) => (
                            <Card key={med.id} style={styles.itemCard} mode="outlined">
                                <Card.Content style={styles.itemContent}>
                                    <View style={[styles.itemIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <MaterialCommunityIcons name="pill" size={24} color={theme.colors.primary} />
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                            {med.name} {med.dosage}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {med.frequency}
                                        </Text>
                                        {med.instructions && (
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                {med.instructions}
                                            </Text>
                                        )}
                                    </View>
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                )}

                {/* Extracted Health Metrics */}
                {metrics.length > 0 && (
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                            Extracted Health Metrics ({metrics.length})
                        </Text>
                        {metrics.map((metric) => (
                            <Card key={metric.id} style={styles.itemCard} mode="outlined">
                                <Card.Content style={styles.itemContent}>
                                    <View style={[styles.itemIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                                        <MaterialCommunityIcons name="heart-pulse" size={24} color={theme.colors.secondary} />
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                            {metric.metric_type}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {metric.value} {metric.unit}
                                        </Text>
                                    </View>
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                )}
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
    documentImage: {
        width: '100%',
        height: width * 0.8,
        backgroundColor: '#f0f0f0',
    },
    summaryCard: {
        borderRadius: tokens.radius.lg,
        marginBottom: tokens.spacing.lg,
    },
    section: {
        marginBottom: tokens.spacing.lg,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: tokens.spacing.md,
    },
    itemCard: {
        marginBottom: tokens.spacing.sm,
        borderRadius: tokens.radius.md,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.md,
    },
    itemIcon: {
        width: 44,
        height: 44,
        borderRadius: tokens.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
    },
});
