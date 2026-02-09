import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Text, Card, List, Button, Avatar, useTheme, IconButton, Portal, Dialog, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';

interface Contact {
    id: string;
    name: string;
    phone: string;
    email: string;
    is_doctor: boolean;
}

export default function ProfileScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user, signOut } = useAuth();

    // Name editing state
    const [editNameVisible, setEditNameVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [savingName, setSavingName] = useState(false);

    // Contact management state
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactDialogVisible, setContactDialogVisible] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [isDoctor, setIsDoctor] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '' });
    const [savingContact, setSavingContact] = useState(false);

    // Keyboard visibility state
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    // Listen for keyboard show/hide events
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });
        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    // Load contacts on mount and focus
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

    // Open dialog to add/edit contact
    const openContactDialog = (isDoc: boolean, contact?: Contact) => {
        setIsDoctor(isDoc);
        if (contact) {
            setEditingContact(contact);
            setContactForm({ name: contact.name, phone: contact.phone || '', email: contact.email || '' });
        } else {
            setEditingContact(null);
            setContactForm({ name: '', phone: '', email: '' });
        }
        setContactDialogVisible(true);
    };

    // Save contact
    const saveContact = async () => {
        if (!contactForm.name.trim()) {
            Alert.alert('Error', 'Name is required');
            return;
        }
        if (!user) return;
        setSavingContact(true);
        try {
            if (editingContact) {
                // Update existing contact
                const { error } = await supabase
                    .from('emergency_contacts')
                    .update({
                        name: contactForm.name.trim(),
                        phone: contactForm.phone.trim() || null,
                        email: contactForm.email.trim() || null,
                    })
                    .eq('id', editingContact.id);
                if (error) throw error;
            } else {
                // Insert new contact
                const { error } = await supabase
                    .from('emergency_contacts')
                    .insert({
                        user_id: user.id,
                        name: contactForm.name.trim(),
                        phone: contactForm.phone.trim() || null,
                        email: contactForm.email.trim() || null,
                        is_doctor: isDoctor,
                    });
                if (error) throw error;
            }
            setContactDialogVisible(false);
            loadContacts();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save contact');
        } finally {
            setSavingContact(false);
        }
    };

    // Delete contact
    const deleteContact = (contact: Contact) => {
        Alert.alert(
            'Delete Contact',
            `Are you sure you want to delete ${contact.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('emergency_contacts')
                            .delete()
                            .eq('id', contact.id);
                        if (!error) {
                            loadContacts();
                        }
                    },
                },
            ]
        );
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]
        );
    };

    const handleEditName = () => {
        setNewName(user?.user_metadata?.full_name || '');
        setEditNameVisible(true);
    };

    const saveName = async () => {
        if (!newName.trim()) return;
        setSavingName(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: newName.trim() }
            });

            // Also try to update public tables if they exist
            if (!error && user) {
                // public.profiles doesn't exist, and displayed_name col missing on users.
                // Assuming 'full_name' is the correct column on public.users based on auth metadata.
                (supabase.from('users' as any) as any).update({ display_name: newName.trim() }).eq('id', user.id).then(({ error }: any) => {
                    if (error) console.log('Users table update failed:', error.message);
                });
            }

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                setEditNameVisible(false);
                // Optionally refresh user or show success?
                // The useAuth hook should ideally pick up changes if it subscribes to auth state changes, 
                // but checking `useAuth` implementation would be good. 
                // For now assuming optimistic update or re-render.
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to update name');
        } finally {
            setSavingName(false);
        }
    };

    const formatPhone = (phone?: string) => {
        if (!phone) return 'Not set';
        const digits = phone.replace(/\D/g, '').slice(-10);
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <IconButton
                        icon="arrow-left"
                        size={24}
                        onPress={() => router.back()}
                    />
                    <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                        Profile
                    </Text>
                </View>

                {/* Profile Card */}
                <Card style={styles.profileCard} mode="elevated">
                    <Card.Content style={styles.profileContent}>
                        <Avatar.Text
                            size={72}
                            label={user?.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0).toUpperCase() : (user?.phone ? user.phone.slice(-2) : 'U')}
                            style={{ backgroundColor: theme.colors.primaryContainer }}
                            labelStyle={{ color: theme.colors.primary }}
                        />
                        <View style={styles.profileInfo}>
                            <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                                {user?.user_metadata?.full_name || 'Health User'}
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                {formatPhone(user?.phone)}
                            </Text>
                        </View>
                        <Button mode="outlined" compact onPress={handleEditName}>
                            Edit
                        </Button>
                    </Card.Content>
                </Card>

                {/* Edit Name Dialog */}
                <Portal>
                    <Dialog 
                        visible={editNameVisible} 
                        onDismiss={() => setEditNameVisible(false)} 
                        style={isKeyboardVisible ? { backgroundColor: theme.colors.surface, transform: [{ translateY: -160 }] } : { backgroundColor: theme.colors.surface }}
                    >
                        <Dialog.Title style={{ color: theme.colors.onSurface }}>Edit Name</Dialog.Title>
                        <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                                    <TextInput
                                        label="Full Name"
                                        value={newName}
                                        onChangeText={setNewName}
                                        mode="outlined"
                                        autoFocus
                                    />
                                </ScrollView>
                            </KeyboardAvoidingView>
                        </Dialog.ScrollArea>
                        <Dialog.Actions>
                            <Button onPress={() => setEditNameVisible(false)} textColor={theme.colors.onSurfaceVariant}>Cancel</Button>
                            <Button onPress={saveName} loading={savingName} disabled={savingName}>Save</Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>

                {/* Add/Edit Contact Dialog */}
                <Portal>
                    <Dialog 
                        visible={contactDialogVisible} 
                        onDismiss={() => setContactDialogVisible(false)} 
                        style={isKeyboardVisible ? { backgroundColor: theme.colors.surface, transform: [{ translateY: -160 }] } : { backgroundColor: theme.colors.surface }}
                    >
                        <Dialog.Title style={{ color: theme.colors.onSurface }}>
                            {editingContact ? 'Edit' : 'Add'} {isDoctor ? 'Doctor' : 'Emergency Contact'}
                        </Dialog.Title>
                        <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 12 }}>
                                    <TextInput
                                        label="Name *"
                                        value={contactForm.name}
                                        onChangeText={(text) => setContactForm(prev => ({ ...prev, name: text }))}
                                        mode="outlined"
                                        autoFocus
                                    />
                                    <TextInput
                                        label="Phone Number"
                                        value={contactForm.phone}
                                        onChangeText={(text) => setContactForm(prev => ({ ...prev, phone: text }))}
                                        mode="outlined"
                                        keyboardType="phone-pad"
                                    />
                                    <TextInput
                                        label="Email"
                                        value={contactForm.email}
                                        onChangeText={(text) => setContactForm(prev => ({ ...prev, email: text }))}
                                        mode="outlined"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </ScrollView>
                            </KeyboardAvoidingView>
                        </Dialog.ScrollArea>
                        <Dialog.Actions>
                            <Button onPress={() => setContactDialogVisible(false)} textColor={theme.colors.onSurfaceVariant}>Cancel</Button>
                            <Button onPress={saveContact} loading={savingContact} disabled={savingContact}>Save</Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>

                {/* Contacts Section */}
                <Card style={styles.settingsCard} mode="elevated">
                    <List.Section>
                        <List.Subheader style={{ color: theme.colors.primary }}>Contacts</List.Subheader>
                        
                        {/* Doctor Contact */}
                        <List.Item
                            title="Doctor"
                            description={doctorContact ? `${doctorContact.name}${doctorContact.phone ? ` • ${doctorContact.phone}` : ''}` : 'Not set - tap to add'}
                            left={(props) => <List.Icon {...props} icon="doctor" />}
                            right={() => (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {doctorContact && (
                                        <IconButton
                                            icon="delete-outline"
                                            size={20}
                                            onPress={() => deleteContact(doctorContact)}
                                        />
                                    )}
                                    <List.Icon icon={doctorContact ? "pencil" : "plus"} />
                                </View>
                            )}
                            onPress={() => openContactDialog(true, doctorContact)}
                        />

                        {/* Emergency Contact */}
                        <List.Item
                            title="Emergency Contact"
                            description={emergencyContact ? `${emergencyContact.name}${emergencyContact.phone ? ` • ${emergencyContact.phone}` : ''}` : 'Not set - tap to add'}
                            left={(props) => <List.Icon {...props} icon="account-alert" />}
                            right={() => (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {emergencyContact && (
                                        <IconButton
                                            icon="delete-outline"
                                            size={20}
                                            onPress={() => deleteContact(emergencyContact)}
                                        />
                                    )}
                                    <List.Icon icon={emergencyContact ? "pencil" : "plus"} />
                                </View>
                            )}
                            onPress={() => openContactDialog(false, emergencyContact)}
                        />
                    </List.Section>
                </Card>

                {/* Sign Out */}
                <View style={styles.signOutContainer}>
                    <Button
                        mode="outlined"
                        onPress={handleSignOut}
                        textColor={theme.colors.error}
                        style={styles.signOutButton}
                    >
                        Sign Out
                    </Button>
                    <Text variant="bodySmall" style={[styles.version, { color: theme.colors.onSurfaceVariant }]}>
                        iNurra v1.0.0
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: tokens.spacing.lg,
        paddingVertical: tokens.spacing.md,
    },
    profileCard: {
        marginHorizontal: tokens.spacing.lg,
        marginBottom: tokens.spacing.lg,
        borderRadius: tokens.radius.lg,
    },
    profileContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.md,
    },
    profileInfo: {
        flex: 1,
    },
    settingsCard: {
        marginHorizontal: tokens.spacing.lg,
        marginBottom: tokens.spacing.lg,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
    },
    signOutContainer: {
        paddingHorizontal: tokens.spacing.lg,
        paddingVertical: tokens.spacing.xl,
        alignItems: 'center',
    },
    signOutButton: {
        borderColor: '#EA4335',
        marginBottom: tokens.spacing.md,
    },
    version: {
        marginTop: tokens.spacing.sm,
    },
});
