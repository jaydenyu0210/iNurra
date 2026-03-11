import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, Pressable, Keyboard, TextInput, DeviceEventEmitter, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { IconButton, Text, Surface, useTheme, Menu } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '../theme/tokens';
import { sendChatMessage, transcribeAudio } from '../services/api';
import { supabase } from '../services/supabase';
import { AIDataConsentDialog } from './AIDataConsentDialog';

const { width, height } = Dimensions.get('window');

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

/**
 * AppFooter Component
 * 
 * Replaces the traditional tab bar and Floating Action Button.
 * Provides access to Camera (Upload) and AI Assistant with half-screen chat.
 */
export function AppFooter() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isDialogueOpen, setIsDialogueOpen] = useState(false);
    const [inputText, setInputText] = useState('');

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | undefined>(undefined);
    const scrollViewRef = useRef<ScrollView>(null);

    // Voice mode state - toggles between text input and hold-to-speak
    const [isVoiceMode, setIsVoiceMode] = useState(false);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const recordingRef = useRef<Audio.Recording | null>(null);

    // Menu state
    const [menuVisible, setMenuVisible] = useState(false);

    // AI data consent state
    const [consentGranted, setConsentGranted] = useState(false);
    const [consentChecked, setConsentChecked] = useState(false);
    const [showConsentDialog, setShowConsentDialog] = useState(false);

    // Check AI data consent on mount
    useEffect(() => {
        async function checkConsent() {
            try {
                const consent = await AsyncStorage.getItem('ai_data_consent_granted');
                setConsentGranted(consent === 'true');
            } catch (e) {
                console.error('Error checking AI consent:', e);
            } finally {
                setConsentChecked(true);
            }
        }
        checkConsent();
    }, []);

    const handleConsentGranted = async () => {
        try {
            await AsyncStorage.setItem('ai_data_consent_granted', 'true');
            setConsentGranted(true);
            setShowConsentDialog(false);
            // Now open the chat since they consented
            openChatDialogue();
        } catch (e) {
            console.error('Error saving AI consent:', e);
        }
    };

    const handleConsentDeclined = () => {
        setShowConsentDialog(false);
    };

    // Animations
    const dialogTranslateY = useRef(new Animated.Value(height)).current;

    // Load chat history on mount
    useEffect(() => {
        async function loadChatHistory() {
            if (!supabase) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Get most recent session
                const { data: sessions } = await supabase
                    .from('chat_sessions')
                    .select('id')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false })
                    .limit(1);

                if (sessions && sessions.length > 0) {
                    const latestSession = sessions[0] as { id: string };
                    setSessionId(latestSession.id);

                    // Load messages from this session
                    const { data: msgs } = await supabase
                        .from('chat_messages')
                        .select('id, role, content, created_at')
                        .eq('session_id', latestSession.id)
                        .order('created_at', { ascending: true });

                    if (msgs && msgs.length > 0) {
                        const loadedMessages: ChatMessage[] = msgs.map((msg: any) => ({
                            id: msg.id,
                            role: msg.role as 'user' | 'assistant',
                            content: msg.content,
                        }));
                        setMessages(loadedMessages);
                    }
                }
            } catch (err) {
                console.error('Failed to load chat history:', err);
            }
        }
        loadChatHistory();
    }, []);

    // Clear chat history
    const handleClearHistory = async () => {
        setMenuVisible(false);
        try {
            if (sessionId && supabase) {
                // Delete messages from the database
                await supabase
                    .from('chat_messages')
                    .delete()
                    .eq('session_id', sessionId);
            }
            // Reset local state
            setMessages([]);
            setSessionId(undefined);
        } catch (err) {
            console.error('Failed to clear chat history:', err);
        }
    };

    const openChatDialogue = () => {
        DeviceEventEmitter.emit('STOP_SPEAKING');
        setIsDialogueOpen(true);
        Animated.spring(dialogTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 90,
        }).start();
    };

    // Wrapper that checks consent before opening chat
    const handleAskNurra = () => {
        if (consentChecked && !consentGranted) {
            setShowConsentDialog(true);
        } else {
            openChatDialogue();
        }
    };

    const closeChatDialogue = () => {
        Keyboard.dismiss();
        Animated.timing(dialogTranslateY, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setIsDialogueOpen(false);
            setIsVoiceMode(false);
        });
    };

    const handleCameraPress = () => {
        router.push('/documents/upload');
    };

    // Send message to chat API
    const handleSendMessage = useCallback(async (text?: string) => {
        const messageText = text || inputText.trim();
        if (!messageText || isLoading) return;

        // Add user message
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
        };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        // Scroll to bottom
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);

        try {
            const response = await sendChatMessage(messageText, sessionId);

            if (response.sessionId) {
                setSessionId(response.sessionId);
            }

            if (response.message) {
                // Clean extra newlines from AI response
                const cleanedMessage = response.message
                    .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
                    .replace(/^\n+/, '')          // Remove leading newlines
                    .replace(/\n+$/, '')          // Remove trailing newlines
                    .trim();

                const aiMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: cleanedMessage,
                };
                setMessages(prev => [...prev, aiMessage]);

                // Scroll to bottom after AI response
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm having trouble connecting. Please try again.",
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [inputText, isLoading, sessionId]);

    // Voice recording handlers
    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status === 'granted') {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                });
                const { recording } = await Audio.Recording.createAsync(
                    Audio.RecordingOptionsPresets.HIGH_QUALITY
                );
                recordingRef.current = recording;
                setIsRecording(true);
            }
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        const activeRecording = recordingRef.current;
        if (!activeRecording) return;

        setIsRecording(false);
        setIsTranscribing(true);

        try {
            await activeRecording.stopAndUnloadAsync();
            const uri = activeRecording.getURI();
            recordingRef.current = null;

            if (uri) {
                const base64Audio = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const { text } = await transcribeAudio(base64Audio);

                if (text) {
                    // Put transcribed text in input field and switch to keyboard mode
                    setInputText(text);
                    setIsVoiceMode(false);
                }
            }
        } catch (err) {
            console.error('Failed to transcribe', err);
        } finally {
            setIsTranscribing(false);
        }
    };

    const renderMessage = (message: ChatMessage) => {
        const isUser = message.role === 'user';
        return (
            <View
                key={message.id}
                style={[
                    styles.messageContainer,
                    isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
                ]}
            >
                {!isUser && (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="robot" size={16} color={theme.colors.primary} />
                    </View>
                )}
                <View
                    style={[
                        styles.messageBubble,
                        isUser
                            ? { backgroundColor: theme.colors.primary }
                            : { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                >
                    <Text
                        variant="bodyMedium"
                        style={{ color: isUser ? theme.colors.onPrimary : theme.colors.onSurface }}
                    >
                        {message.content}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <>
            {/* AI Data Consent Dialog */}
            <AIDataConsentDialog
                visible={showConsentDialog}
                onConsent={handleConsentGranted}
                onDecline={handleConsentDeclined}
            />
            {/* Tap-outside overlay to close chat */}
            {isDialogueOpen && (
                <Pressable
                    style={styles.overlay}
                    onPress={closeChatDialogue}
                />
            )}

            {/* KeyboardAvoidingView wraps chat + footer when dialogue is open */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingContainer}
                keyboardVerticalOffset={0}
                pointerEvents="box-none"
            >
                {/* Half-Screen Chat Dialogue */}
                {isDialogueOpen && (
                    <Animated.View
                        style={[
                            styles.dialogueContainer,
                            {
                                transform: [{ translateY: dialogTranslateY }],
                                backgroundColor: theme.colors.surface,
                                height: height * 0.42,
                                maxHeight: height - insets.top - 80, // Don't extend past safe area (80 = footer height)
                            }
                        ]}
                    >
                        {/* Header with menu and X button */}
                        <View style={styles.dialogueHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="robot" size={24} color={theme.colors.primary} style={{ marginRight: 8 }} />
                                <Text variant="titleMedium" style={{ fontWeight: '600' }}>Nurra - Health Assistant</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Menu
                                    visible={menuVisible}
                                    onDismiss={() => setMenuVisible(false)}
                                    anchor={
                                        <IconButton
                                            icon="dots-vertical"
                                            size={24}
                                            onPress={() => setMenuVisible(true)}
                                            style={{ margin: 0 }}
                                        />
                                    }
                                >
                                    <Menu.Item
                                        onPress={handleClearHistory}
                                        title="Clear History"
                                        leadingIcon="delete-outline"
                                    />
                                </Menu>
                                <IconButton
                                    icon="close"
                                    size={24}
                                    onPress={closeChatDialogue}
                                    style={{ margin: 0 }}
                                />
                            </View>
                        </View>

                        {/* Chat Messages */}
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.messagesContainer}
                            contentContainerStyle={styles.messagesContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {messages.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="chat-question" size={48} color={theme.colors.outline} />
                                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
                                        Ask me anything about your health data!
                                    </Text>
                                </View>
                            ) : (
                                messages.map(renderMessage)
                            )}

                            {/* Loading indicator */}
                            {isLoading && (
                                <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
                                    <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <MaterialCommunityIcons name="robot" size={16} color={theme.colors.primary} />
                                    </View>
                                    <View style={[styles.messageBubble, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <ActivityIndicator size="small" color={theme.colors.primary} />
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </Animated.View>
                )}

                {/* Footer Bar */}
                <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]} elevation={4}>
                    {/* Left: Camera (hidden when chat is open) */}
                    {!isDialogueOpen && (
                        <IconButton
                            icon="camera-outline"
                            size={32}
                            iconColor={theme.colors.onSurface}
                            onPress={handleCameraPress}
                            style={[styles.sideButton, { marginLeft: 4 }]}
                        />
                    )}

                    {/* Center: Interaction Area */}
                    <View style={[styles.centerContainer, isDialogueOpen && { flex: 3, paddingHorizontal: 10 }]}>
                        {isDialogueOpen ? (
                            isVoiceMode ? (
                                // Voice mode: Hold to speak button
                                <Pressable
                                    style={[
                                        styles.holdToSpeakButton,
                                        {
                                            backgroundColor: isRecording
                                                ? theme.colors.errorContainer
                                                : theme.colors.surfaceVariant,
                                        }
                                    ]}
                                    onPressIn={startRecording}
                                    onPressOut={stopRecording}
                                    disabled={isTranscribing || isLoading}
                                >
                                    <MaterialCommunityIcons
                                        name={isRecording ? "microphone" : "microphone-outline"}
                                        size={24}
                                        color={isRecording ? theme.colors.error : theme.colors.onSurfaceVariant}
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text
                                        variant="bodyLarge"
                                        style={{
                                            color: isRecording ? theme.colors.error : theme.colors.onSurfaceVariant,
                                            fontWeight: '500',
                                        }}
                                    >
                                        {isTranscribing ? 'Transcribing...' : isRecording ? 'Recording...' : 'Hold to speak'}
                                    </Text>
                                </Pressable>
                            ) : (
                                // Keyboard mode: Text input with send button
                                <View style={styles.inputRow}>
                                    <TextInput
                                        style={[styles.inputField, { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }]}
                                        placeholder="Type a message..."
                                        placeholderTextColor={theme.colors.onSurfaceVariant}
                                        value={inputText}
                                        onChangeText={setInputText}
                                        onSubmitEditing={() => handleSendMessage()}
                                        returnKeyType="send"
                                        editable={!isLoading}
                                        multiline={true}
                                        numberOfLines={3}
                                        textAlignVertical="center"
                                    />
                                    <IconButton
                                        icon="send"
                                        size={24}
                                        iconColor={inputText.trim() ? theme.colors.primary : theme.colors.outline}
                                        onPress={() => handleSendMessage()}
                                        disabled={!inputText.trim() || isLoading}
                                        style={{ margin: 0 }}
                                    />
                                </View>
                            )
                        ) : (
                            // Default state: Empty center
                            <View />
                        )}
                    </View>

                    {/* Right: Ask Nurra button or Mode Toggle */}
                    {!isDialogueOpen ? (
                        <Pressable
                            style={[styles.askAiButton, { backgroundColor: theme.colors.primaryContainer }]}
                            onPress={handleAskNurra}
                        >
                            <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600' }}>Ask Nurra</Text>
                        </Pressable>
                    ) : (
                        <IconButton
                            icon={isVoiceMode ? 'keyboard' : 'microphone'}
                            size={28}
                            iconColor={theme.colors.onSurface}
                            onPress={() => setIsVoiceMode(!isVoiceMode)}
                            style={styles.sideButton}
                            disabled={isTranscribing || isLoading}
                        />
                    )}
                </Surface>
            </KeyboardAvoidingView>
        </>
    );
}

const styles = StyleSheet.create({
    keyboardAvoidingContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 25,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 80,
        zIndex: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    dialogueContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    dialogueHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 8,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    userMessageContainer: {
        justifyContent: 'flex-end',
    },
    assistantMessageContainer: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
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
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    inputField: {
        flex: 1,
        minHeight: 44,
        maxHeight: 100,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
    },
    holdToSpeakButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 16,
    },
});
