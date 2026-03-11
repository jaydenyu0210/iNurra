import { View, StyleSheet, ScrollView, Modal } from 'react-native';
import { Text, Button, useTheme, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { tokens } from '../theme';

interface AIDataConsentDialogProps {
    visible: boolean;
    onConsent: () => void;
    onDecline: () => void;
}

export function AIDataConsentDialog({ visible, onConsent, onDecline }: AIDataConsentDialogProps) {
    const theme = useTheme();
    const router = useRouter();

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={[styles.dialog, { backgroundColor: theme.colors.surface }]}>
                    <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
                        AI Data Sharing Consent
                    </Text>

                    <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                        <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurface }]}>
                            Nurra uses a third-party AI service to answer your health questions and provide insights. Before using this feature, please review how your data is used.
                        </Text>

                        <Divider style={styles.divider} />

                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            What data is sent
                        </Text>
                        <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurfaceVariant }]}>
                            When you use the Nurra chat, the following data may be sent for processing:
                        </Text>
                        <View style={styles.bulletList}>
                            <BulletItem>Your chat messages and questions</BulletItem>
                            <BulletItem>Medications (names, dosages, schedules)</BulletItem>
                            <BulletItem>Health metrics (e.g. blood pressure readings)</BulletItem>
                            <BulletItem>Body conditions and bodily excretions</BulletItem>
                            <BulletItem>Todo items and calendar events</BulletItem>
                            <BulletItem>Uploaded medical documents and summaries</BulletItem>
                            <BulletItem>Voice audio (if using voice input)</BulletItem>
                        </View>

                        <Divider style={styles.divider} />

                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            Who receives this data
                        </Text>
                        <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurfaceVariant }]}>
                            Your data is sent to <Text style={{ fontWeight: 'bold' }}>Google's Gemini AI</Text> through Google's Generative Language API. Google processes this data to generate responses to your questions, provide health insights, and transcribe voice input.
                        </Text>
                        <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurfaceVariant }]}>
                            Google's use of this data is governed by{' '}
                            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Google's Privacy Policy</Text>.
                        </Text>

                        <Divider style={styles.divider} />

                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            Your choice
                        </Text>
                        <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurfaceVariant }]}>
                            You may decline and continue using all other features of iNurra without Nurra. You can review our full{' '}
                            <Text
                                style={{ color: theme.colors.primary, fontWeight: '600' }}
                                onPress={() => router.push('/privacy')}
                            >
                                Privacy Policy
                            </Text>{' '}
                            for more details.
                        </Text>
                    </ScrollView>

                    <View style={styles.actions}>
                        <Button
                            mode="outlined"
                            onPress={onDecline}
                            style={styles.actionButton}
                        >
                            Decline
                        </Button>
                        <Button
                            mode="contained"
                            onPress={onConsent}
                            style={styles.actionButton}
                        >
                            I Agree
                        </Button>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function BulletItem({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    return (
        <View style={styles.bulletItem}>
            <Text style={[styles.bulletPoint, { color: theme.colors.onSurfaceVariant }]}>•</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
                {children}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacing.lg,
    },
    dialog: {
        borderRadius: tokens.radius.xl,
        maxHeight: '85%',
        width: '100%',
        paddingTop: tokens.spacing.xl,
        paddingBottom: tokens.spacing.lg,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    title: {
        textAlign: 'center',
        fontWeight: 'bold',
        marginBottom: tokens.spacing.md,
        paddingHorizontal: tokens.spacing.lg,
    },
    scrollArea: {
        paddingHorizontal: tokens.spacing.lg,
        maxHeight: 400,
    },
    paragraph: {
        marginBottom: tokens.spacing.sm,
        lineHeight: 22,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: tokens.spacing.xs,
    },
    divider: {
        marginVertical: tokens.spacing.md,
    },
    bulletList: {
        marginTop: tokens.spacing.xs,
    },
    bulletItem: {
        flexDirection: 'row',
        marginBottom: tokens.spacing.xs,
        paddingLeft: tokens.spacing.sm,
    },
    bulletPoint: {
        marginRight: tokens.spacing.sm,
        fontSize: 16,
        lineHeight: 22,
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: tokens.spacing.lg,
        paddingTop: tokens.spacing.md,
        gap: tokens.spacing.sm,
    },
    actionButton: {
        flex: 1,
    },
});
