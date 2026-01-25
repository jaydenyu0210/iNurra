import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, IconButton, useTheme, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks';
import { tokens } from '../../src/theme';

export default function PhoneScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { signInWithOtp, isLoading } = useAuth();

    const [phone, setPhone] = useState('');
    const [error, setError] = useState<string | null>(null);

    const formatPhoneDisplay = (value: string) => {
        // Remove all non-digits
        const digits = value.replace(/\D/g, '');

        // Format as (XXX) XXX-XXXX
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    };

    const handlePhoneChange = (value: string) => {
        setError(null);
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 10) {
            setPhone(formatPhoneDisplay(value));
        }
    };

    const getFullPhoneNumber = () => {
        const digits = phone.replace(/\D/g, '');
        return `+1${digits}`;
    };

    const isValidPhone = () => {
        const digits = phone.replace(/\D/g, '');
        return digits.length === 10;
    };

    const handleSubmit = async () => {
        if (!isValidPhone()) {
            setError('Please enter a valid 10-digit phone number');
            return;
        }

        const fullPhone = getFullPhoneNumber();
        const { error: signInError } = await signInWithOtp(fullPhone);

        if (signInError) {
            setError(signInError.message);
        } else {
            router.push({
                pathname: '/(auth)/verify',
                params: { phone: fullPhone },
            });
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Header */}
                <View style={styles.header}>
                    <IconButton
                        icon="arrow-left"
                        size={24}
                        onPress={() => router.back()}
                        style={styles.backButton}
                    />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
                        Enter your phone number
                    </Text>
                    <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        We'll send you a verification code to sign in securely
                    </Text>

                    <View style={styles.inputContainer}>
                        <View style={[styles.countryCode, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                🇺🇸 +1
                            </Text>
                        </View>
                        <TextInput
                            mode="outlined"
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChangeText={handlePhoneChange}
                            keyboardType="phone-pad"
                            autoFocus
                            style={styles.input}
                            outlineStyle={styles.inputOutline}
                            error={!!error}
                        />
                    </View>

                    {error && (
                        <HelperText type="error" visible={!!error}>
                            {error}
                        </HelperText>
                    )}
                </View>

                {/* CTA */}
                <View style={styles.cta}>
                    <Button
                        mode="contained"
                        onPress={handleSubmit}
                        loading={isLoading}
                        disabled={!isValidPhone() || isLoading}
                        style={styles.button}
                        contentStyle={styles.buttonContent}
                    >
                        Continue
                    </Button>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        paddingHorizontal: tokens.spacing.sm,
        paddingTop: tokens.spacing.sm,
    },
    backButton: {
        marginLeft: 0,
    },
    content: {
        flex: 1,
        paddingHorizontal: tokens.spacing.lg,
        paddingTop: tokens.spacing.lg,
    },
    title: {
        fontWeight: '600',
        marginBottom: tokens.spacing.sm,
    },
    subtitle: {
        marginBottom: tokens.spacing.xl,
    },
    inputContainer: {
        flexDirection: 'row',
        gap: tokens.spacing.sm,
        alignItems: 'center',
    },
    countryCode: {
        paddingHorizontal: tokens.spacing.md,
        paddingVertical: tokens.spacing.md,
        borderRadius: tokens.radius.sm,
        height: 56,
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        fontSize: 18,
    },
    inputOutline: {
        borderRadius: tokens.radius.sm,
    },
    cta: {
        paddingHorizontal: tokens.spacing.lg,
        paddingBottom: tokens.spacing.xl,
    },
    button: {
        borderRadius: tokens.radius.xl,
    },
    buttonContent: {
        paddingVertical: tokens.spacing.sm,
    },
});
