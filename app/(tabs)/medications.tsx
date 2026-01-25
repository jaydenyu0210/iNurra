import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { deleteMedication } from '../../src/services/api';

interface Medication {
    id: string;
    name: string;
    dosage: string;
    frequency: number; // hours
    instructions?: string;
    quantity?: number;
    is_active: boolean;
    created_at: string;
}

export default function MedicationsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const [medications, setMedications] = useState<Medication[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMedications = useCallback(async () => {
        if (!user?.id) return;

        try {
            const { data, error } = await supabase
                .from('medications')
                .select('*')
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
        }, [fetchMedications])
    );

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
                        setMedications(meds => meds.filter(m => m.id !== medId));

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

    const renderMedicationItem = ({ item }: { item: Medication }) => (
        <Card
            style={styles.medCard}
            mode="elevated"
            onPress={() => router.push(`/medications/${item.id}`)}
        >
            <Card.Content style={styles.medCardContent}>
                <View style={[styles.medIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <MaterialCommunityIcons name="pill" size={24} color={theme.colors.primary} />
                </View>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    {item.name}
                </Text>
                <IconButton
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    size={20}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id, item.name);
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
