import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput as RNTextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, IconButton, useTheme, HelperText } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks';
import { tokens } from '../../src/theme';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const { verifyOtp, signInWithOtp, isLoading } = useAuth();

    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [error, setError] = useState<string | null>(null);
    const [resendCountdown, setResendCountdown] = useState(30);

    const inputRefs = useRef<(RNTextInput | null)[]>([]);

    useEffect(() => {
        // Focus first input on mount
        inputRefs.current[0]?.focus();
    }, []);

    useEffect(() => {
        // Countdown timer for resend
        if (resendCountdown > 0) {
            const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCountdown]);

    const handleCodeChange = (value: string, index: number) => {
        setError(null);

        // Handle paste
        if (value.length > 1) {
            const pastedCode = value.slice(0, CODE_LENGTH).split('');
            const newCode = [...code];
            pastedCode.forEach((char, i) => {
                if (index + i < CODE_LENGTH) {
                    newCode[index + i] = char;
                }
            });
            setCode(newCode);

            // Focus appropriate input
            const focusIndex = Math.min(index + pastedCode.length, CODE_LENGTH - 1);
            inputRefs.current[focusIndex]?.focus();

            // Auto-submit if complete
            if (newCode.every(c => c !== '')) {
                handleSubmit(newCode.join(''));
            }
            return;
        }

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Move to next input
        if (value && index < CODE_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit if complete
        if (value && index === CODE_LENGTH - 1 && newCode.every(c => c !== '')) {
            handleSubmit(newCode.join(''));
        }
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
            const newCode = [...code];
            newCode[index - 1] = '';
            setCode(newCode);
        }
    };

    const handleSubmit = async (codeString?: string) => {
        const fullCode = codeString || code.join('');

        if (fullCode.length !== CODE_LENGTH) {
            setError('Please enter the complete verification code');
            return;
        }

        const { error: verifyError } = await verifyOtp(phone || '', fullCode);

        if (verifyError) {
            setError('Invalid verification code. Please try again.');
            setCode(Array(CODE_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        }
        // Success will be handled by auth redirect in _layout
    };

    const handleResend = async () => {
        if (resendCountdown > 0) return;

        const { error: resendError } = await signInWithOtp(phone || '');

        if (resendError) {
            setError('Failed to resend code. Please try again.');
        } else {
            setResendCountdown(30);
            setError(null);
        }
    };

    const formatPhone = (phoneNumber: string) => {
        if (!phoneNumber) return '';
        const digits = phoneNumber.replace(/\D/g, '').slice(-10);
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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
                        Verify your number
                    </Text>
                    <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Enter the 6-digit code sent to{'\n'}
                        <Text style={{ color: theme.colors.primary }}>{formatPhone(phone || '')}</Text>
                    </Text>

                    {/* Code Input */}
                    <View style={styles.codeContainer}>
                        {Array(CODE_LENGTH).fill(0).map((_, index) => (
                            <RNTextInput
                                key={index}
                                ref={(ref) => { inputRefs.current[index] = ref; }}
                                style={[
                                    styles.codeInput,
                                    {
                                        backgroundColor: theme.colors.surfaceVariant,
                                        borderColor: code[index] ? theme.colors.primary : theme.colors.outline,
                                        color: theme.colors.onSurface,
                                    },
                                    error && styles.codeInputError,
                                ]}
                                value={code[index]}
                                onChangeText={(value) => handleCodeChange(value, index)}
                                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                                keyboardType="number-pad"
                                maxLength={index === 0 ? CODE_LENGTH : 1}
                                selectTextOnFocus
                            />
                        ))}
                    </View>

                    {error && (
                        <HelperText type="error" visible={!!error} style={styles.error}>
                            {error}
                        </HelperText>
                    )}

                    {/* Resend */}
                    <View style={styles.resendContainer}>
                        {resendCountdown > 0 ? (
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Resend code in {resendCountdown}s
                            </Text>
                        ) : (
                            <Button
                                mode="text"
                                onPress={handleResend}
                                disabled={isLoading}
                            >
                                Resend Code
                            </Button>
                        )}
                    </View>
                </View>

                {/* CTA */}
                <View style={styles.cta}>
                    <Button
                        mode="contained"
                        onPress={() => handleSubmit()}
                        loading={isLoading}
                        disabled={code.some(c => !c) || isLoading}
                        style={styles.button}
                        contentStyle={styles.buttonContent}
                    >
                        Verify
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
        lineHeight: 24,
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: tokens.spacing.sm,
    },
    codeInput: {
        flex: 1,
        height: 56,
        borderRadius: tokens.radius.sm,
        borderWidth: 2,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '600',
    },
    codeInputError: {
        borderColor: '#EA4335',
    },
    error: {
        textAlign: 'center',
        marginTop: tokens.spacing.sm,
    },
    resendContainer: {
        alignItems: 'center',
        marginTop: tokens.spacing.xl,
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
