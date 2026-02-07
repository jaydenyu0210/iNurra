import { View, StyleSheet, Image } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../../src/theme';

export default function WelcomeScreen() {
    const theme = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                {/* Hero Section */}
                <View style={styles.hero}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                        <Image source={require('../../assets/icon.png')} style={styles.iconImage} resizeMode="contain" />
                    </View>
                    <Text variant="displaySmall" style={[styles.title, { color: theme.colors.onBackground }]}>
                        iNurra
                    </Text>
                    <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Your personal health assistant that helps you track and understand your medical records                 </Text>
                </View>


            </View>

            {/* CTA Button */}
            <View style={styles.cta}>
                <Button
                    mode="contained"
                    onPress={() => router.push('/(auth)/phone')}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}
                >
                    Get Started
                </Button>
                <Text variant="bodySmall" style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}>
                    By continuing, you agree to our Terms of Service and Privacy Policy
                </Text>
            </View>
        </SafeAreaView>
    );
}

function FeatureItem({
    emoji,
    title,
    description,
    theme,
}: {
    emoji: string;
    title: string;
    description: string;
    theme: any;
}) {
    return (
        <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>{emoji}</Text>
            <View style={styles.featureText}>
                <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
                    {title}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {description}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: tokens.spacing.lg,
        paddingTop: tokens.spacing.xxl,
    },
    hero: {
        alignItems: 'center',
        marginBottom: tokens.spacing.xl,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: tokens.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: tokens.spacing.lg,
    },
    iconImage: {
        width: 80,
        height: 80,
    },
    title: {
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: tokens.spacing.sm,
    },
    subtitle: {
        textAlign: 'center',
        paddingHorizontal: tokens.spacing.lg,
    },
    features: {
        marginTop: tokens.spacing.xl,
        gap: tokens.spacing.lg,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: tokens.spacing.md,
    },
    featureEmoji: {
        fontSize: 28,
        width: 40,
    },
    featureText: {
        flex: 1,
        gap: tokens.spacing.xs,
    },
    cta: {
        paddingHorizontal: tokens.spacing.lg,
        paddingBottom: tokens.spacing.xxl + 20,
        gap: tokens.spacing.md,
    },
    button: {
        borderRadius: tokens.radius.xl,
    },
    buttonContent: {
        paddingVertical: tokens.spacing.sm,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    disclaimer: {
        textAlign: 'center',
        paddingHorizontal: tokens.spacing.lg,
    },
});
