import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, Pressable, Platform, Keyboard, TextInput, Modal } from 'react-native';
import { IconButton, Text, Surface, useTheme, Button } from 'react-native-paper';
import { useRouter, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';

const { width, height } = Dimensions.get('window');

/**
 * AppFooter Component
 * 
 * Replaces the traditional tab bar and Floating Action Button.
 * Provides access to Camera (Upload) and AI Assistant.
 */
export function AppFooter() {
    const theme = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const [mode, setMode] = useState<'default' | 'talking' | 'keyboard'>('default');
    const [isDialogueOpen, setIsDialogueOpen] = useState(false);
    const [inputText, setInputText] = useState('');

    // Animations
    const centerButtonOpacity = useRef(new Animated.Value(0)).current;
    const dialogTranslateY = useRef(new Animated.Value(height)).current;

    const toggleMode = (targetMode: 'talking' | 'keyboard') => {
        if (mode === 'default') {
            setMode(targetMode);
            Animated.timing(centerButtonOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else if (mode === targetMode) {
            // Toggle off if needed
        } else {
            setMode(targetMode);
        }
    };

    const openChatDialogue = () => {
        setIsDialogueOpen(true);
        Animated.spring(dialogTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 90,
        }).start();
    };

    const closeChatDialogue = () => {
        Keyboard.dismiss();
        Animated.timing(dialogTranslateY, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setIsDialogueOpen(false);
            setMode('default');
            Animated.timing(centerButtonOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleCameraPress = () => {
        router.push('/documents/upload');
    };

    const isKeyboard = mode === 'keyboard';

    return (
        <>
            {/* Dialogue Box Overlay */}
            {isDialogueOpen && (
                <Animated.View style={[styles.dialogueContainer, { transform: [{ translateY: dialogTranslateY }], backgroundColor: theme.colors.surface }]}>
                    <View style={styles.dialogueHeader}>
                        <Text variant="titleMedium">AI Assistant</Text>
                        <IconButton icon="close" size={20} onPress={closeChatDialogue} />
                    </View>
                    <View style={styles.dialogueContent}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                            {mode === 'talking' ? "Listening..." : "How can I help you?"}
                        </Text>
                    </View>
                </Animated.View>
            )}

            {/* Overlay */}
            {(mode !== 'default' && !isDialogueOpen) && (
                <Pressable style={styles.overlay} onPress={() => {
                    setMode('default');
                    Animated.timing(centerButtonOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                }} />
            )}

            <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]} elevation={4}>
                {/* Left: Camera */}
                <IconButton
                    icon="camera-outline"
                    size={28}
                    iconColor={theme.colors.onSurface}
                    onPress={handleCameraPress}
                    style={styles.sideButton}
                />

                {/* Center: Interaction Area */}
                <View style={[styles.centerContainer, isKeyboard && { flex: 2, paddingHorizontal: 10 }]}>
                    {isKeyboard ? (
                        <TextInput
                            style={[styles.inputField, { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurfaceVariant }]}
                            placeholder="Type a message..."
                            placeholderTextColor={theme.colors.onSurfaceDisabled}
                            value={inputText}
                            onChangeText={setInputText}
                            onFocus={openChatDialogue}
                        />
                    ) : (
                        <Animated.View
                            style={[
                                styles.talkingContainer,
                                { opacity: centerButtonOpacity, transform: [{ scale: centerButtonOpacity }] }
                            ]}
                            pointerEvents={mode === 'talking' ? 'auto' : 'none'}
                        >
                            <Pressable
                                style={({ pressed }) => [
                                    styles.talkingTextButton,
                                    { opacity: pressed ? 0.6 : 1 }
                                ]}
                                onLongPress={() => {
                                    openChatDialogue();
                                    console.log('Start recording...');
                                }}
                                onPress={() => {
                                    // Just a tap implies hold hint
                                }}
                                onPressOut={() => {
                                    console.log('Stop recording...');
                                }}
                                delayLongPress={200} // Quicker response
                            >
                                <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                                    Hold to speak
                                </Text>
                            </Pressable>
                        </Animated.View>
                    )}
                </View>

                {/* Right: AI Toggle */}
                {mode === 'default' ? (
                    <Pressable
                        style={[styles.askAiButton, { backgroundColor: theme.colors.primaryContainer }]}
                        onPress={() => toggleMode('talking')}
                    >
                        <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600' }}>Ask AI</Text>
                    </Pressable>
                ) : (
                    <IconButton
                        icon={mode === 'keyboard' ? 'microphone' : 'keyboard'}
                        size={28}
                        iconColor={theme.colors.onSurface}
                        onPress={() => toggleMode(mode === 'keyboard' ? 'talking' : 'keyboard')}
                        style={styles.sideButton}
                    />
                )}
            </Surface>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 80,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    dialogueContainer: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 90,
        height: 300,
        borderRadius: 24,
        padding: 20,
        zIndex: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    dialogueHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dialogueContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        height: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: 20,
        borderTopLeftRadius: tokens.radius.xl,
        borderTopRightRadius: tokens.radius.xl,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
    },
    sideButton: {
        margin: 0,
    },
    askAiButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        position: 'relative',
    },
    inputField: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    talkingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    },
    talkingTextButton: {
        padding: 10, // Target size
        alignItems: 'center',
        justifyContent: 'center',
    },
});
