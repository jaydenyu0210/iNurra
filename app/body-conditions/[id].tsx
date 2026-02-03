import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { BodyCondition, BodilyExcretion } from '../../src/types/database';

const { width } = Dimensions.get('window');

export default function BodyConditionDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id, type } = useLocalSearchParams<{ id: string, type: 'condition' | 'excretion' }>();
    const { user } = useAuth();

    const [condition, setCondition] = useState<BodyCondition | null>(null);
    const [excretion, setExcretion] = useState<BodilyExcretion | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            if (!id || !user?.id || !type) {
                setError('Item not found');
                setLoading(false);
                return;
            }

            try {
                if (type === 'condition') {
                    const { data, error: fetchError } = await supabase
                        .from('body_conditions')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (fetchError) throw fetchError;
                    setCondition(data);

                    if (data?.document_id) {
                        await fetchDocumentImage(data.document_id);
                    }
                } else if (type === 'excretion') {
                    const { data, error: fetchError } = await supabase
                        .from('bodily_excretions')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (fetchError) throw fetchError;
                    setExcretion(data);

                    if (data?.document_id) {
                        await fetchDocumentImage(data.document_id);
                    }
                }
            } catch (err) {
                console.error('Error fetching details:', err);
                setError('Failed to load details');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [id, type, user?.id]);

    const fetchDocumentImage = async (documentId: string) => {
        try {
            const { data: doc } = await supabase
                .from('documents')
                .select('storage_path')
                .eq('id', documentId)
                .single();

            if (doc?.storage_path) {
                const { data: urlData } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(doc.storage_path, 3600);

                if (urlData?.signedUrl) {
                    setImageUrl(urlData.signedUrl);
                }
            }
        } catch (e) {
            console.error('Error fetching image:', e);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Entry',
            'Are you sure you want to delete this entry?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const table = type === 'condition' ? 'body_conditions' : 'bodily_excretions';
                            const { error: deleteError } = await supabase
                                .from(table)
                                .delete()
                                .eq('id', id);

                            if (deleteError) throw deleteError;
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete entry');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </SafeAreaView>
        );
    }

    if (error || (!condition && !excretion)) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="alert-circle" size={64} color={theme.colors.error} />
                <Text variant="titleMedium" style={{ marginTop: 16, color: theme.colors.error }}>
                    {error || 'Item not found'}
                </Text>
                <IconButton icon="arrow-left" size={24} onPress={() => router.back()} style={{ marginTop: 16 }} />
            </SafeAreaView>
        );
    }

    const title = type === 'condition' 
        ? `${condition?.condition_type || 'Body Condition'}`
        : `${excretion?.excretion_type ? excretion.excretion_type.charAt(0).toUpperCase() + excretion.excretion_type.slice(1) : 'Excretion'}`;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                <Text variant="titleLarge" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                    {title}
                </Text>
                <IconButton icon="delete-outline" iconColor={theme.colors.error} size={24} onPress={handleDelete} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {imageUrl && (
                    <Card style={styles.imageCard} mode="elevated">
                        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
                    </Card>
                )}

                <Card style={styles.detailsCard} mode="outlined">
                    <Card.Content style={styles.cardContent}>
                        {type === 'condition' && condition && (
                            <>
                                <DetailItem label="Type" value={condition.condition_type} />
                                <DetailItem label="Location" value={condition.body_location} />
                                <DetailItem label="Description" value={condition.location_description} />
                                <DetailItem 
                                    label="Severity" 
                                    value={condition.severity} 
                                    valueColor={theme.colors.error}
                                />
                                <DetailItem 
                                    label="Observed" 
                                    value={new Date(condition.observed_at).toLocaleString()} 
                                />
                                <View style={styles.row}>
                                    <DetailItem label="Width" value={condition.width_mm ? `${condition.width_mm} mm` : null} style={{ flex: 1 }} />
                                    <DetailItem label="Height" value={condition.height_mm ? `${condition.height_mm} mm` : null} style={{ flex: 1 }} />
                                </View>
                                <DetailItem label="Color" value={condition.color} />
                                <DetailItem label="Texture" value={condition.texture} />
                                <DetailItem label="Shape" value={condition.shape} />
                                <DetailItem label="Notes" value={condition.notes} />
                            </>
                        )}

                        {type === 'excretion' && excretion && (
                            <>
                                <DetailItem label="Type" value={excretion.excretion_type} />
                                <DetailItem label="Observed" value={new Date(excretion.observed_at).toLocaleString()} />
                                <DetailItem label="Color" value={excretion.color} />
                                <DetailItem label="Consistency" value={excretion.consistency} />
                                <DetailItem label="Volume" value={excretion.volume_ml ? `${excretion.volume_ml} ml` : null} />
                                <DetailItem label="Frequency" value={excretion.frequency_per_day ? `${excretion.frequency_per_day}/day` : null} />
                                <DetailItem 
                                    label="Blood Present" 
                                    value={excretion.blood_present ? 'Yes' : 'No'} 
                                    valueColor={excretion.blood_present ? theme.colors.error : undefined}
                                />
                                <DetailItem label="Pain Level" value={excretion.pain_level ? `${excretion.pain_level}/10` : null} />
                                {excretion.abnormality_indicators && excretion.abnormality_indicators.length > 0 && (
                                    <DetailItem label="Abnormalities" value={excretion.abnormality_indicators.join(', ')} valueColor={theme.colors.error} />
                                )}
                                <DetailItem label="Notes" value={excretion.notes} />
                            </>
                        )}
                    </Card.Content>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

function DetailItem({ label, value, valueColor, style }: { label: string, value: string | number | null | undefined, valueColor?: string, style?: any }) {
    const theme = useTheme();
    if (!value) return null;
    return (
        <View style={[styles.detailItem, style]}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
            <Text variant="bodyLarge" style={{ color: valueColor || theme.colors.onSurface, marginTop: 2 }}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: tokens.spacing.sm },
    content: { padding: tokens.spacing.lg, paddingBottom: 40 },
    imageCard: { marginBottom: tokens.spacing.lg, borderRadius: tokens.radius.lg, overflow: 'hidden', backgroundColor: '#f0f0f0' },
    image: { width: '100%', height: width * 0.8 },
    detailsCard: { borderRadius: tokens.radius.lg },
    cardContent: { gap: tokens.spacing.md },
    detailItem: { marginBottom: tokens.spacing.xs },
    row: { flexDirection: 'row', gap: tokens.spacing.md },
});

