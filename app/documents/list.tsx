import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, ActivityIndicator, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../src/theme';
import { useAuth } from '../../src/hooks';
import { supabase } from '../../src/services/supabase';
import { deleteDocument } from '../../src/services/api';

interface Document {
    id: string;
    type: string;
    content_labels?: string[];
    file_name: string;
    title?: string;
    summary?: string;
    created_at: string;
}

export default function DocumentsListScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<Document[]>([]);

    const fetchDocuments = useCallback(async () => {
        if (!user?.id) return;
        if (!supabase) return;

        try {
            // Fetch all documents first
            const { data: docs, error } = await supabase
                .from('documents')
                .select('id, type, content_labels, file_name, title, summary, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch document IDs that have linked data
            const [medsResult, metricsResult, conditionsResult] = await Promise.all([
                supabase.from('medications').select('document_id').eq('user_id', user.id),
                supabase.from('health_metrics').select('source_document_id').eq('user_id', user.id),
                supabase.from('body_conditions').select('document_id').eq('user_id', user.id),
            ]);

            // Collect all document IDs that have extracted data
            const excludedIds = new Set<string>();
            medsResult.data?.forEach((m: any) => m.document_id && excludedIds.add(m.document_id));
            metricsResult.data?.forEach((m: any) => m.source_document_id && excludedIds.add(m.source_document_id));
            conditionsResult.data?.forEach((c: any) => c.document_id && excludedIds.add(c.document_id));

            // Filter out documents with extracted data
            const filteredDocs = (docs || []).filter((doc: any) => !excludedIds.has(doc.id));
            setDocuments(filteredDocs);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDocuments();
        setRefreshing(false);
    };

    const handleDeleteDocument = (docId: string, docName: string) => {
        Alert.alert(
            'Delete Document',
            `Are you sure you want to delete "${docName}"? This will also remove any extracted data.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const prevDocs = documents;
                        setDocuments(docs => docs.filter(d => d.id !== docId));
                        try {
                            await deleteDocument(docId);
                            fetchDocuments();
                        } catch (error) {
                            setDocuments(prevDocs);
                            Alert.alert('Error', 'Failed to delete document');
                        }
                    },
                },
            ]
        );
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
                        <Card key={doc.id} style={styles.card} mode="elevated" onPress={() => router.push(`/documents/${doc.id}`)} onLongPress={() => handleDeleteDocument(doc.id, doc.title || doc.file_name)}>
                            <Card.Content style={styles.cardContent}>
                                <View style={[styles.iconBox, { backgroundColor: theme.colors.secondaryContainer }]}>
                                    <MaterialCommunityIcons
                                        name={getDocTypeIcon(doc.type, doc.content_labels) as any}
                                        size={24}
                                        color={theme.colors.secondary}
                                    />
                                </View>
                                <View style={styles.info}>
                                    <Text variant="titleMedium" numberOfLines={1}>
                                        {doc.title || doc.file_name}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {formatDate(doc.created_at)}
                                    </Text>
                                    {doc.content_labels && doc.content_labels.length > 0 && (
                                        <View style={styles.labelsRow}>
                                            {doc.content_labels.slice(0, 3).map((label, idx) => (
                                                <Text key={idx} variant="labelSmall" style={{ color: theme.colors.primary, marginRight: 8 }}>
                                                    #{label.replace('_', ' ')}
                                                </Text>
                                            ))}
                                            {doc.content_labels.length > 3 && (
                                                <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                                                    +{doc.content_labels.length - 3}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                                <IconButton
                                    icon="delete-outline"
                                    iconColor={theme.colors.error}
                                    size={20}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDocument(doc.id, doc.title || doc.file_name);
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
    labelsRow: { flexDirection: 'row', marginTop: 4 },
    emptyState: { alignItems: 'center', marginTop: 60 },
});
