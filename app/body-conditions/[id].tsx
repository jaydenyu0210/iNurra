import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert, TouchableOpacity } from 'react-native';
import { Text, useTheme, IconButton, ActivityIndicator, Portal, Dialog, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { tokens } from '../../src/theme';
import { BodyCondition, BodilyExcretion } from '../../src/types/database';

// Helper to format status for display
const formatStatus = (status: string | null): string => {
    switch (status) {
        case 'improving': return 'Improving';
        case 'worsening': return 'Worsening';
        case 'no_significant_change': return 'No Change';
        case 'initial':
        default: return 'Initial';
    }
};

// Get status color and background
const getStatusColors = (status: string | null) => {
    switch (status) {
        case 'improving':
            return { bg: '#4CAF5020', text: '#4CAF50' };
        case 'worsening':
            return { bg: '#F4433620', text: '#F44336' };
        case 'no_significant_change':
            return { bg: '#9E9E9E20', text: '#9E9E9E' };
        case 'initial':
        default:
            return { bg: '#2196F320', text: '#2196F3' };
    }
};

// Helper to format label to display name
const formatLabelToDisplayName = (label: string): string => {
    return label
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Photo item component with image loading
const PhotoItem = ({ condition, theme, onPress }: { condition: BodyCondition, theme: any, onPress: () => void }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadImage = async () => {
            if (condition.document_id && supabase) {
                try {
                    const { data: doc } = await supabase
                        .from('documents')
                        .select('storage_path')
                        .eq('id', condition.document_id)
                        .single();

                    const storagePath = (doc as any)?.storage_path;
                    if (storagePath) {
                        const { data } = await supabase.storage
                            .from('documents')
                            .createSignedUrl(storagePath, 3600);

                        if (data?.signedUrl) {
                            setImageUrl(data.signedUrl);
                        }
                    }
                } catch (e) {
                    console.error('Error loading condition image:', e);
                }
            }
        };
        loadImage();
    }, [condition.document_id]);

    const statusColors = getStatusColors(condition.progression_status);

    return (
        <TouchableOpacity style={styles.photoItem} onPress={onPress}>
            <View style={[styles.photoThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}>
                {imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                ) : (
                    <MaterialCommunityIcons name="image" size={32} color={theme.colors.outline} />
                )}
            </View>
            <View style={styles.photoInfo}>
                <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <Text style={{ color: statusColors.text, fontWeight: 'bold', fontSize: 11 }}>
                        {formatStatus(condition.progression_status)}
                    </Text>
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    {format(new Date(condition.observed_at), 'MMM d, yyyy h:mm a')}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

// Helper to render text with bullet points if multiple sentences
const renderTextWithBullets = (text: string | null | undefined, marginBottom: number = 16) => {
    if (!text) return <Text variant="bodyMedium" style={{ marginBottom }}>Not available</Text>;

    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length <= 1) {
        return <Text variant="bodyMedium" style={{ marginBottom }}>{text}</Text>;
    }
    return (
        <View style={{ marginBottom }}>
            {sentences.map((s: string, i: number) => (
                <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
            ))}
        </View>
    );
};

// Detail item for excretion view
const DetailItem = ({ label, value }: { label: string, value: string | null | undefined }) => {
    const theme = useTheme();
    if (!value) return null;
    return (
        <View style={styles.detailItem}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, marginTop: 2 }}>{value}</Text>
        </View>
    );
};

export default function BodyConditionDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const { id, type } = useLocalSearchParams<{ id: string; type: string }>();

    const [conditions, setConditions] = useState<BodyCondition[]>([]);
    const [excretion, setExcretion] = useState<BodilyExcretion | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [selectedCondition, setSelectedCondition] = useState<BodyCondition | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        async function fetchData() {
            if (!id || !user?.id) return;

            try {
                if (type === 'label') {
                    // Fetch all conditions with this label
                    if (!supabase) throw new Error('Supabase client not initialized');
                    const { data, error: fetchError } = await supabase
                        .from('body_conditions')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('label', id)
                        .order('observed_at', { ascending: true });

                    if (fetchError) throw fetchError;
                    setConditions((data as BodyCondition[]) || []);
                } else if (type === 'excretion') {
                    if (!supabase) throw new Error('Supabase client not initialized');
                    const { data, error: fetchError } = await supabase
                        .from('bodily_excretions')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (fetchError) throw fetchError;
                    setExcretion(data as BodilyExcretion);
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

    const handleDelete = (conditionId: string) => {
        Alert.alert(
            'Delete Photo',
            'Are you sure you want to delete this photo?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (!supabase) throw new Error('Supabase client not initialized');
                            const { error: deleteError } = await supabase
                                .from('body_conditions')
                                .delete()
                                .eq('id', conditionId);

                            if (deleteError) throw deleteError;

                            // Remove from local state
                            setConditions(prev => prev.filter(c => c.id !== conditionId));
                            setModalVisible(false);
                            setSelectedCondition(null);

                            // If no conditions left, go back
                            if (conditions.length <= 1) {
                                router.back();
                            }
                        } catch (e) {
                            console.error('Error deleting:', e);
                            Alert.alert('Error', 'Failed to delete photo');
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteExcretion = () => {
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
                            if (!supabase) throw new Error('Supabase client not initialized');
                            const { error: deleteError } = await supabase
                                .from('bodily_excretions')
                                .delete()
                                .eq('id', id);

                            if (deleteError) throw deleteError;
                            router.back();
                        } catch (e) {
                            console.error('Error deleting:', e);
                            Alert.alert('Error', 'Failed to delete entry');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                    <Text variant="titleLarge" style={{ color: theme.colors.onBackground, flex: 1 }}>Loading...</Text>
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                    <Text variant="titleLarge" style={{ color: theme.colors.onBackground, flex: 1 }}>Error</Text>
                </View>
                <View style={styles.centerContent}>
                    <MaterialCommunityIcons name="alert-circle" size={48} color={theme.colors.error} />
                    <Text style={{ color: theme.colors.error, marginTop: tokens.spacing.md }}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Label view - show list of photos
    if (type === 'label' && conditions.length > 0) {
        const displayName = conditions[0].label
            ? formatLabelToDisplayName(conditions[0].label)
            : conditions[0].condition_type || 'Condition';

        const selectedStatusColors = selectedCondition ? getStatusColors(selectedCondition.progression_status) : null;

        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                    <Text variant="titleLarge" style={{ color: theme.colors.onBackground, flex: 1, fontWeight: '600' }}>
                        {displayName}
                    </Text>
                    <IconButton
                        icon="plus"
                        size={24}
                        onPress={() => router.push({
                            pathname: '/documents/upload',
                            params: { presetLabel: id }
                        })}
                    />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: tokens.spacing.lg }}>
                        {conditions.length} {conditions.length === 1 ? 'photo' : 'photos'} recorded
                    </Text>

                    <View style={styles.photoGrid}>
                        {conditions.map((condition) => (
                            <PhotoItem
                                key={condition.id}
                                condition={condition}
                                theme={theme}
                                onPress={() => {
                                    setSelectedCondition(condition);
                                    setModalVisible(true);
                                }}
                            />
                        ))}
                    </View>
                </ScrollView>

                {/* Detail Dialog - Matching verify details page style */}
                <Portal>
                    <Dialog
                        visible={modalVisible}
                        onDismiss={() => {
                            setModalVisible(false);
                            setSelectedCondition(null);
                        }}
                        style={{ width: '90%', alignSelf: 'center', borderRadius: 8 }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
                            <IconButton
                                icon="delete"
                                iconColor={theme.colors.error}
                                size={20}
                                onPress={() => selectedCondition && handleDelete(selectedCondition.id)}
                            />
                            <IconButton icon="close" size={20} onPress={() => {
                                setModalVisible(false);
                                setSelectedCondition(null);
                            }} />
                        </View>
                        <Dialog.Title style={{ paddingRight: 80 }}>
                            {selectedCondition?.condition_type || 'Body Condition'}
                        </Dialog.Title>
                        <Dialog.ScrollArea style={{ maxHeight: 630, paddingHorizontal: 0 }}>
                            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}>
                                {selectedCondition && (
                                    <View>
                                        {/* Location and Status */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Location</Text>
                                                <Text variant="bodyMedium">{selectedCondition.body_location || 'Unknown'}</Text>
                                            </View>
                                            <View>
                                                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Status</Text>
                                                <Chip style={{ backgroundColor: selectedStatusColors?.bg }}>
                                                    <Text style={{
                                                        color: selectedStatusColors?.text,
                                                        fontWeight: 'bold',
                                                        textTransform: 'capitalize'
                                                    }}>
                                                        {formatStatus(selectedCondition.progression_status)}
                                                    </Text>
                                                </Chip>
                                            </View>
                                        </View>

                                        {/* Measurements */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Size</Text>
                                                <Text variant="bodyMedium">
                                                    {selectedCondition.size ? `${selectedCondition.size} cm²` : 'Not recorded'}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Color Depth</Text>
                                                <Text variant="bodyMedium">
                                                    {selectedCondition.color_depth !== null && selectedCondition.color_depth !== undefined
                                                        ? `${selectedCondition.color_depth.toFixed(2)} / 1.0`
                                                        : 'Not recorded'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Possible Condition */}
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Possible Condition</Text>
                                        {renderTextWithBullets(selectedCondition.possible_condition)}

                                        {/* Possible Cause */}
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Possible Cause</Text>
                                        {renderTextWithBullets(selectedCondition.possible_cause)}

                                        {/* Care Advice */}
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Care Advice</Text>
                                        {renderTextWithBullets(selectedCondition.care_advice)}

                                        {/* Precautions */}
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Precautions</Text>
                                        {renderTextWithBullets(selectedCondition.precautions)}

                                        {/* When to Seek Care */}
                                        <Text variant="labelLarge" style={{ color: theme.colors.error, marginBottom: 4 }}>When to Seek Care</Text>
                                        {renderTextWithBullets(selectedCondition.when_to_seek_care, 0)}

                                        {/* Recorded At */}
                                        <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
                                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Recorded At</Text>
                                            <Text variant="bodyMedium">{format(new Date(selectedCondition.observed_at), 'MMM d, yyyy h:mm a')}</Text>
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                        </Dialog.ScrollArea>
                    </Dialog>
                </Portal>
            </SafeAreaView>
        );
    }

    // Excretion detail view (unchanged from original)
    if (type === 'excretion' && excretion) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                    <Text variant="titleLarge" style={{ color: theme.colors.onBackground, flex: 1, fontWeight: '600' }}>
                        {excretion.excretion_type}
                    </Text>
                    <IconButton
                        icon="delete"
                        iconColor={theme.colors.error}
                        size={24}
                        onPress={handleDeleteExcretion}
                    />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <DetailItem label="Type" value={excretion.excretion_type} />
                    <DetailItem label="Color" value={excretion.color} />
                    <DetailItem label="Consistency" value={excretion.consistency} />
                    <DetailItem label="Volume" value={excretion.volume_ml ? `${excretion.volume_ml} ml` : null} />
                    <DetailItem label="Frequency" value={excretion.frequency_per_day ? `${excretion.frequency_per_day}x per day` : null} />
                    <DetailItem label="Blood Present" value={excretion.blood_present ? 'Yes' : 'No'} />
                    <DetailItem label="Pain Level" value={excretion.pain_level ? `${excretion.pain_level}/10` : null} />
                    <DetailItem label="Notes" value={excretion.notes} />
                    <DetailItem label="Recorded At" value={format(new Date(excretion.observed_at), 'MMM d, yyyy h:mm a')} />
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
                <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>Not Found</Text>
            </View>
            <View style={styles.centerContent}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>No data found</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.sm,
    },
    content: {
        padding: tokens.spacing.lg,
        paddingBottom: tokens.spacing.xxl,
    },
    photoGrid: {
        flexDirection: 'column',
        gap: tokens.spacing.lg,
    },
    photoItem: {
        width: '100%',
        marginBottom: tokens.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        // Add shadow for better list card appearance
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    photoThumbnail: {
        width: 80,
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    photoInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    detailItem: {
        marginBottom: tokens.spacing.lg,
    },
});
