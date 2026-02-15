import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../src/theme';

export default function PrivacyPolicyScreen() {
    const theme = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Privacy Policy',
                    headerLeft: () => null,
                    headerRight: () => (
                        <IconButton
                            icon="close"
                            size={24}
                            onPress={() => router.back()}
                            iconColor={theme.colors.onSurface}
                        />
                    ),
                }}
            />
            <ScrollView contentContainerStyle={styles.content}>
                <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.primary }]}>
                    iNurra Privacy Policy
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: tokens.spacing.lg }}>
                    Last updated: 2/8/2026
                </Text>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: tokens.spacing.lg }}>
                    iNurra (“we,” “our,” or “us”) respects your privacy and is committed to protecting your personal and health information. This Privacy Policy explains how iNurra collects, uses, and safeguards information when you use the iNurra mobile application (the “App”).
                </Text>

                <Section title="1. Information We Collect">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        We collect information that you voluntarily provide to us in order to deliver the core functionality of iNurra.
                    </Text>
                    <Subsection title="a. Personal Information">
                        <Bullet>Phone number (used for account sign-in and authentication)</Bullet>
                        <Bullet>Optional contact information you provide, such as doctor or emergency contact details</Bullet>
                    </Subsection>
                    <Subsection title="b. Health and Medical Information">
                        <Bullet>Medical photos (e.g. prescription labels, medical devices, body conditions)</Bullet>
                        <Bullet>Health metrics extracted from uploaded images (e.g. blood pressure readings)</Bullet>
                        <Bullet>Medical documents (e.g. discharge summaries, doctor’s notes)</Bullet>
                        <Bullet>Health-related notes or records you choose to upload</Bullet>
                    </Subsection>
                    <Subsection title="c. User Content">
                        <Bullet>Photos, documents, and text you upload to the App</Bullet>
                        <Bullet>Search queries or questions you ask the AI assistant</Bullet>
                    </Subsection>
                    <Subsection title="d. Usage and Diagnostics Information">
                        <Bullet>Product interaction data (such as feature usage and app navigation)</Bullet>
                        <Bullet>Crash data and performance data (such as app stability, load times, and errors)</Bullet>
                    </Subsection>
                </Section>

                <Section title="2. How We Use Your Information">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        We use the information we collect only to provide and improve the App’s functionality, including to:
                    </Text>
                    <Bullet>Authenticate users and manage accounts</Bullet>
                    <Bullet>Analyze uploaded medical images and documents</Bullet>
                    <Bullet>Provide health-related insights and nursing guidance for informational purposes</Bullet>
                    <Bullet>Generate medication schedules and reminders</Bullet>
                    <Bullet>Track health metrics and trends over time</Bullet>
                    <Bullet>Enable the AI assistant (“Nura”) to respond based on your uploaded data</Bullet>
                    <Bullet>Maintain app security, reliability, and performance</Bullet>
                    <Bullet>Diagnose and fix bugs or crashes</Bullet>
                    <Bullet>Provide customer support</Bullet>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: tokens.spacing.sm }}>
                        We do not use your data for advertising or marketing purposes.
                    </Text>
                </Section>

                <Section title="3. AI and Automated Processing">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        iNurra uses automated systems and artificial intelligence to analyze user-provided data (such as medical images or documents) in order to deliver App features. All AI-generated insights are provided for informational purposes only and are not a substitute for professional medical advice, diagnosis, or treatment.
                    </Text>
                </Section>

                <Section title="4. Data Sharing">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        We do not sell, rent, or share your personal or health data with advertisers, data brokers, or third parties for marketing purposes.
                        We may share limited data only:
                    </Text>
                    <Bullet>With trusted service providers that help operate the App (such as cloud storage or crash reporting services), strictly for App functionality and reliability</Bullet>
                    <Bullet>When required by law or to protect the safety, rights, or security of users or the App</Bullet>
                </Section>

                <Section title="5. Data Retention">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        We retain your data only for as long as necessary to provide the App’s services or until you delete your account or content, unless a longer retention period is required by law.
                    </Text>
                </Section>

                <Section title="6. Data Security">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        We implement reasonable technical and organizational safeguards designed to protect your information from unauthorized access, disclosure, or misuse. However, no system can be guaranteed to be 100% secure.
                    </Text>
                </Section>

                <Section title="7. Your Choices and Rights">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        You may:
                    </Text>
                    <Bullet>Access, update, or delete your information within the App</Bullet>
                    <Bullet>Request account deletion and data removal by contacting us</Bullet>
                </Section>

                <Section title="8. Children’s Privacy">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        iNurra is not intended for children and does not knowingly collect personal information from individuals under the age of 16.
                    </Text>
                </Section>

                <Section title="9. Changes to This Privacy Policy">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        We may update this Privacy Policy from time to time. Any changes will be posted within the App or on this page with an updated “Last updated” date.
                    </Text>
                </Section>

                <Section title="10. Contact Us">
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        If you have questions or concerns about this Privacy Policy or your data, please contact us at:
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.primary, marginTop: tokens.spacing.xs }}>
                        Email: jiaweiyu2009@gmail.com
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        App Name: iNurra
                    </Text>
                </Section>

                <View style={{ height: tokens.spacing.xxl }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const theme = useTheme();
    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                {title}
            </Text>
            {children}
        </View>
    );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
    const theme = useTheme();
    return (
        <View style={styles.subsection}>
            <Text variant="titleSmall" style={[styles.subsectionTitle, { color: theme.colors.onBackground }]}>
                {title}
            </Text>
            {children}
        </View>
    );
}

function Bullet({ children }: { children: React.ReactNode }) {
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
    container: {
        flex: 1,
    },
    content: {
        padding: tokens.spacing.lg,
    },
    title: {
        marginBottom: tokens.spacing.xs,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: tokens.spacing.xl,
    },
    sectionTitle: {
        marginBottom: tokens.spacing.sm,
        fontWeight: '600',
    },
    subsection: {
        marginTop: tokens.spacing.md,
        marginBottom: tokens.spacing.sm,
        paddingLeft: tokens.spacing.md,
    },
    subsectionTitle: {
        marginBottom: tokens.spacing.xs,
        fontWeight: '600',
    },
    bulletItem: {
        flexDirection: 'row',
        marginBottom: tokens.spacing.xs,
        paddingLeft: tokens.spacing.sm,
    },
    bulletPoint: {
        marginRight: tokens.spacing.sm,
        fontSize: 16,
        lineHeight: 24,
    },
});
