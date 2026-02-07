import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, IconButton, useTheme, Portal, Dialog, Button, Checkbox, TouchableRipple, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../src/theme';
import { useAuth } from '../../src/hooks';
import { supabase } from '../../src/services/supabase';

interface Contact {
    id: string;
    name: string;
    phone: string;
    email: string;
    is_doctor: boolean;
}

export default function HomeScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();

    // Send report state
    const [reportDialogVisible, setReportDialogVisible] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

    // Load contacts on focus
    const loadContacts = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('emergency_contacts')
            .select('id, name, phone, email, is_doctor')
            .eq('user_id', user.id);
        if (!error && data) {
            setContacts(data);
        }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            loadContacts();
        }, [loadContacts])
    );

    // Get doctor and emergency contact
    const doctorContact = contacts.find(c => c.is_doctor);
    const emergencyContact = contacts.find(c => !c.is_doctor);
    const hasContacts = doctorContact || emergencyContact;

    // Toggle contact selection
    const toggleContactSelection = (contactId: string) => {
        setSelectedContacts(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    // Open report dialog
    const openReportDialog = () => {
        setSelectedContacts([]);
        setReportDialogVisible(true);
    };

    // Handle send report (fake for now)
    const handleSendReport = () => {
        // Fake send - just close dialog
        setReportDialogVisible(false);
    };

    const DASHBOARD_BLOCKS = [
        {
            title: 'Medications',
            icon: 'pill',
            color: theme.colors.primary,
            route: '/(tabs)/medications',
        },
        {
            title: 'Health Metrics',
            icon: 'heart-pulse',
            color: theme.colors.secondary,
            route: '/(tabs)/health',
        },
        {
            title: 'Body Conditions',
            icon: 'human',
            color: '#FF7043', // Deep Orange
            route: '/(tabs)/body-conditions',
        },
        {
            title: 'Documents',
            icon: 'file-document',
            color: theme.colors.tertiary,
            route: '/documents/list',
        },
        {
            title: 'Calendar',
            icon: 'calendar',
            color: '#FBBC04',
            route: '/(tabs)/calendar',
        },
    ];



    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <IconButton
                    icon="cog"
                    size={24}
                    onPress={() => router.push('/(tabs)/profile')}
                />
                <IconButton
                    icon="file-chart"
                    size={24}
                    onPress={openReportDialog}
                />
            </View>

            {/* Send Report Dialog */}
            <Portal>
                <Dialog visible={reportDialogVisible} onDismiss={() => setReportDialogVisible(false)} style={{ backgroundColor: theme.colors.surface }}>
                    <Dialog.Title style={{ color: theme.colors.onSurface }}>Send Report</Dialog.Title>
                    <Dialog.Content>
                        {!hasContacts ? (
                            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                                <MaterialCommunityIcons name="account-alert-outline" size={48} color={theme.colors.onSurfaceVariant} />
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
                                    No doctor or emergency contact saved.
                                </Text>
                                <Button
                                    mode="contained"
                                    onPress={() => {
                                        setReportDialogVisible(false);
                                        router.push('/(tabs)/profile');
                                    }}
                                    style={{ marginTop: 16 }}
                                >
                                    Go to Settings
                                </Button>
                            </View>
                        ) : (
                            <View>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                                    Select recipients to send your health report:
                                </Text>
                                {doctorContact && (
                                    <TouchableRipple 
                                        onPress={() => toggleContactSelection(doctorContact.id)}
                                        borderless
                                        style={{ borderRadius: 12, marginBottom: 12 }}
                                    >
                                        <Surface 
                                            style={[
                                                styles.contactCard,
                                                { backgroundColor: theme.colors.surfaceVariant },
                                                selectedContacts.includes(doctorContact.id) && { 
                                                    borderColor: theme.colors.primary, 
                                                    borderWidth: 2,
                                                    backgroundColor: theme.colors.primaryContainer 
                                                }
                                            ]} 
                                            elevation={1}
                                        >
                                            <View style={[styles.contactIconBox, { backgroundColor: theme.colors.primary + '20' }]}>
                                                <MaterialCommunityIcons name="doctor" size={24} color={theme.colors.primary} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                                    {doctorContact.name}
                                                </Text>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                    Doctor
                                                </Text>
                                            </View>
                                            <Checkbox
                                                status={selectedContacts.includes(doctorContact.id) ? 'checked' : 'unchecked'}
                                                onPress={() => toggleContactSelection(doctorContact.id)}
                                            />
                                        </Surface>
                                    </TouchableRipple>
                                )}
                                {emergencyContact && (
                                    <TouchableRipple 
                                        onPress={() => toggleContactSelection(emergencyContact.id)}
                                        borderless
                                        style={{ borderRadius: 12 }}
                                    >
                                        <Surface 
                                            style={[
                                                styles.contactCard,
                                                { backgroundColor: theme.colors.surfaceVariant },
                                                selectedContacts.includes(emergencyContact.id) && { 
                                                    borderColor: theme.colors.primary, 
                                                    borderWidth: 2,
                                                    backgroundColor: theme.colors.primaryContainer 
                                                }
                                            ]} 
                                            elevation={1}
                                        >
                                            <View style={[styles.contactIconBox, { backgroundColor: '#FF7043' + '20' }]}>
                                                <MaterialCommunityIcons name="account-alert" size={24} color="#FF7043" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                                    {emergencyContact.name}
                                                </Text>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                    Emergency Contact
                                                </Text>
                                            </View>
                                            <Checkbox
                                                status={selectedContacts.includes(emergencyContact.id) ? 'checked' : 'unchecked'}
                                                onPress={() => toggleContactSelection(emergencyContact.id)}
                                            />
                                        </Surface>
                                    </TouchableRipple>
                                )}
                            </View>
                        )}
                    </Dialog.Content>
                    {hasContacts && (
                        <Dialog.Actions>
                            <Button onPress={() => setReportDialogVisible(false)} textColor={theme.colors.onSurfaceVariant}>Cancel</Button>
                            <Button onPress={handleSendReport} disabled={selectedContacts.length === 0}>Send</Button>
                        </Dialog.Actions>
                    )}
                </Dialog>
            </Portal>

            <ScrollView contentContainerStyle={styles.content}>
                {DASHBOARD_BLOCKS.map((block) => (
                    <Card
                        key={block.title}
                        style={styles.card}
                        mode="elevated"
                        onPress={() => router.push(block.route)}
                    >
                        <Card.Content style={styles.cardContent}>
                            <View style={styles.leftContent}>
                                <View style={[styles.iconBox, { backgroundColor: block.color + '20' }]}>
                                    <MaterialCommunityIcons name={block.icon as any} size={32} color={block.color} />
                                </View>
                                <Text variant="titleLarge" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
                                    {block.title}
                                </Text>
                            </View>

                        </Card.Content>
                    </Card>
                ))}
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    greetingContainer: {
        paddingHorizontal: tokens.spacing.lg,
        paddingVertical: tokens.spacing.md,
    },
    content: {
        padding: tokens.spacing.lg,
        gap: tokens.spacing.lg,
        paddingTop: tokens.spacing.sm,
        paddingBottom: 100, // Add padding for footer
    },
    card: {
        borderRadius: tokens.radius.xl,
        justifyContent: 'center',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.md,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: tokens.radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 12,
    },
    contactIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
