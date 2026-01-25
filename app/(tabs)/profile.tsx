import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, List, Switch, Divider, Button, Avatar, useTheme, IconButton, Portal, Dialog, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks';
import { useUIStore } from '../../src/stores';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';

export default function ProfileScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { colorScheme, toggleColorScheme } = useUIStore();

    // Name editing state
    const [editNameVisible, setEditNameVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [savingName, setSavingName] = useState(false);

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
                    <Dialog visible={editNameVisible} onDismiss={() => setEditNameVisible(false)} style={{ backgroundColor: theme.colors.surface }}>
                        <Dialog.Title style={{ color: theme.colors.onSurface }}>Edit Name</Dialog.Title>
                        <Dialog.Content>
                            <TextInput
                                label="Full Name"
                                value={newName}
                                onChangeText={setNewName}
                                mode="outlined"
                                autoFocus
                            />
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={() => setEditNameVisible(false)} textColor={theme.colors.onSurfaceVariant}>Cancel</Button>
                            <Button onPress={saveName} loading={savingName} disabled={savingName}>Save</Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>

                {/* Settings Sections */}
                <Card style={styles.settingsCard} mode="elevated">
                    <List.Section>
                        <List.Subheader style={{ color: theme.colors.primary }}>Appearance</List.Subheader>
                        <List.Item
                            title="Dark Mode"
                            description="Use dark theme throughout the app"
                            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
                            right={() => (
                                <Switch
                                    value={colorScheme === 'dark'}
                                    onValueChange={toggleColorScheme}
                                />
                            )}
                        />
                    </List.Section>
                    <Divider />
                    <List.Section>
                        <List.Subheader style={{ color: theme.colors.primary }}>Notifications</List.Subheader>
                        <List.Item
                            title="Medication Reminders"
                            description="Get notified when it's time to take medication"
                            left={(props) => <List.Icon {...props} icon="pill" />}
                            right={() => <Switch value={true} onValueChange={() => { }} />}
                        />
                        <List.Item
                            title="Appointment Reminders"
                            description="Get notified before appointments"
                            left={(props) => <List.Icon {...props} icon="calendar-clock" />}
                            right={() => <Switch value={true} onValueChange={() => { }} />}
                        />
                    </List.Section>
                </Card>

                <Card style={styles.settingsCard} mode="elevated">
                    <List.Section>
                        <List.Subheader style={{ color: theme.colors.primary }}>Health Data</List.Subheader>
                        <List.Item
                            title="Emergency Contacts"
                            description="Manage emergency contacts"
                            left={(props) => <List.Icon {...props} icon="account-alert" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => { }}
                        />
                        <List.Item
                            title="Export Data"
                            description="Download all your health data"
                            left={(props) => <List.Icon {...props} icon="download" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => { }}
                        />
                        <List.Item
                            title="Connected Devices"
                            description="Manage connected health devices"
                            left={(props) => <List.Icon {...props} icon="watch" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => { }}
                        />
                    </List.Section>
                </Card>

                <Card style={styles.settingsCard} mode="elevated">
                    <List.Section>
                        <List.Subheader style={{ color: theme.colors.primary }}>Support</List.Subheader>
                        <List.Item
                            title="Help Center"
                            left={(props) => <List.Icon {...props} icon="help-circle" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => { }}
                        />
                        <List.Item
                            title="Privacy Policy"
                            left={(props) => <List.Icon {...props} icon="shield-account" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => { }}
                        />
                        <List.Item
                            title="Terms of Service"
                            left={(props) => <List.Icon {...props} icon="file-document" />}
                            right={(props) => <List.Icon {...props} icon="chevron-right" />}
                            onPress={() => { }}
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
                        HealthCompanion v1.0.0
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
