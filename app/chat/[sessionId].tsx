import { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, TextInput as RNTextInput, Alert } from 'react-native';
import { Text, IconButton, Surface, useTheme, ActivityIndicator, Chip, Menu, TouchableRipple } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../src/services/supabase';
import { tokens } from '../../src/theme';

// Typewriter Effect Component
const TypewriterText = ({ content, style, onComplete }: { content: string; style?: any; onComplete?: () => void }) => {
    const [displayedContent, setDisplayedContent] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        // If content changes significantly or we want to re-run? 
        // We only start typing if not complete.
        if (isComplete) {
            setDisplayedContent(content);
            return;
        }

        let i = 0;
        const speed = 30; // ms per char (slower)
        const step = 1; // chars per tick (smoother)

        const interval = setInterval(() => {
            if (i >= content.length) {
                clearInterval(interval);
                setIsComplete(true);
                setDisplayedContent(content);
                if (onComplete) onComplete();
                return;
            }
            setDisplayedContent(content.slice(0, i + step));
            i += step;
        }, speed);

        return () => clearInterval(interval);
    }, [content]);

    return (
        <Text variant="bodyMedium" style={style}>
            {displayedContent}
            {!isComplete && ' |'}
        </Text>
    );
};

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
    timestamp: Date;
    shouldAnimate?: boolean;
}

// Placeholder conversation
const initialMessages: Message[] = [
    {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your health assistant. I can answer questions based on your uploaded medical documents, prescriptions, and health records. What would you like to know?",
        timestamp: new Date(),
    },
];

// Hardcoded fallback questions (Empty for now)
const fallbackQuestions: string[] = [
    // "What medications am I taking?",
    // "Explain my recent test results",
    // "When is my next appointment?",
    // "What should I know about my BP?",
];

export default function ChatScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { sessionId, documentId } = useLocalSearchParams<{ sessionId: string, documentId?: string }>();

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | undefined>(undefined);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isVoiceMode, setIsVoiceMode] = useState(false);

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
                setRecording(recording);
            } else {
                Alert.alert('Permission needed', 'Please grant microphone permission to use voice input.');
            }
        } catch (err) {
            console.error('Failed to start recording', err);
            // Alert.alert('Error', 'Failed to start recording'); 
        }
    };

    const stopRecording = async () => {
        const activeRecording = recordingRef.current;
        if (!activeRecording) return;

        setIsTranscribing(true);
        try {
            await activeRecording.stopAndUnloadAsync();
            const uri = activeRecording.getURI();

            // Cleanup
            recordingRef.current = null;
            setRecording(undefined);

            if (uri) {
                // Read audio file as base64
                const base64Audio = await FileSystem.readAsStringAsync(uri, {
                    encoding: 'base64',
                });

                // Transcribe
                const { transcribeAudio } = await import('../../src/services/api');
                const { text } = await transcribeAudio(base64Audio);

                if (text) {
                    setInputText((prev) => (prev ? prev + ' ' + text : text));
                    setIsVoiceMode(false); // Switch back to text mode after recording
                }
            }
        } catch (err) {
            console.error('Failed to stop/transcribe', err);
            Alert.alert('Error', 'Failed to process audio');
        } finally {
            setIsTranscribing(false);
            recordingRef.current = null;
            setRecording(undefined);
        }
    };
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<RNTextInput>(null);

    // Handle starting a new chat session
    const handleStartNewChat = () => {
        setMenuVisible(false);
        const newSessionId = `new-${Date.now()}`;
        setMessages(initialMessages);
        setSuggestedQuestions([]);
        router.replace(`/chat/${newSessionId}`);
    };

    // Fetch personalized suggestions
    useEffect(() => {
        async function fetchSuggestions() {
            // Only fetch for new sessions or if we haven't fetched yet
            if (messages.length > 1 || suggestedQuestions.length > 0) return;

            setLoadingSuggestions(true);
            try {
                const { sendChatMessage } = await import('../../src/services/api');
                // Call with generateSuggestions=true
                const response = await sendChatMessage(undefined, sessionId, undefined, true);

                if (response.suggestions && response.suggestions.length > 0) {
                    setSuggestedQuestions(response.suggestions);
                } else {
                    setSuggestedQuestions(fallbackQuestions);
                }
            } catch (err) {
                console.error('Error fetching suggestions:', err);
                setSuggestedQuestions(fallbackQuestions);
            } finally {
                setLoadingSuggestions(false);
            }
        }

        // Only fetch if we have a valid session ID (even new ones)
        if (sessionId) {
            // fetchSuggestions(); // Disabled for now
        }
    }, [sessionId]);

    // Load previous messages when resuming an existing session
    useEffect(() => {
        async function loadPreviousMessages() {
            // Skip if this is a new session (starts with 'new-')
            if (!sessionId || sessionId.startsWith('new-')) {
                return;
            }

            setIsLoadingHistory(true);
            try {
                const { data: chatMessages, error } = await supabase
                    .from('chat_messages')
                    .select('id, role, content, created_at')
                    .eq('session_id', sessionId)
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error('Error loading chat history:', error);
                    return;
                }

                if (chatMessages && chatMessages.length > 0) {
                    const loadedMessages: Message[] = chatMessages.map((msg: any) => ({
                        id: msg.id,
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                        timestamp: new Date(msg.created_at),
                        shouldAnimate: false, // Don't animate history
                    }));
                    setMessages(loadedMessages);
                }
            } catch (err) {
                console.error('Error in loadPreviousMessages:', err);
            } finally {
                setIsLoadingHistory(false);
            }
        }

        loadPreviousMessages();
    }, [sessionId]);

    const handleSend = useCallback(async (text?: string) => {
        const messageText = text || inputText.trim();
        if (!messageText || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            // Call the chat Edge Function
            const { sendChatMessage } = await import('../../src/services/api');
            const response = await sendChatMessage(messageText, sessionId, documentId);
            console.log('[Frontend] Chat Response:', JSON.stringify(response, null, 2));

            if (response.message) {
                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response.message,
                    sources: response.sources,
                    timestamp: new Date(),
                    shouldAnimate: true, // Animate new AI response
                };
                setMessages((prev) => [...prev, aiMessage]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            // Fallback to local response if API fails
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm having trouble connecting to the server. Please check your internet connection and try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [inputText, isLoading, sessionId]);

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isUser = item.role === 'user';
        // Inverted list: index 0 is the NEWEST message
        // const isLastMessage = index === 0;

        return (
            <View style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
                {!isUser && (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="robot" size={20} color={theme.colors.primary} />
                    </View>
                )}
                <Surface
                    style={[
                        styles.messageBubble,
                        isUser ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                    elevation={0}
                >
                    {isUser || !item.shouldAnimate || isLoading || isLoadingHistory ? (
                        <Text
                            variant="bodyMedium"
                            style={[
                                styles.messageText,
                                { color: isUser ? theme.colors.onPrimary : theme.colors.onSurface },
                            ]}
                        >
                            {item.content}
                        </Text>
                    ) : (
                        <TypewriterText
                            content={item.content}
                            style={[
                                styles.messageText,
                                { color: theme.colors.onSurface },
                            ]}
                            onComplete={() => {
                                // Disable animation after completion to prevent re-runs
                                setMessages(prev =>
                                    prev.map(msg =>
                                        msg.id === item.id ? { ...msg, shouldAnimate: false } : msg
                                    )
                                );
                            }}
                        />
                    )}

                </Surface>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    size={24}
                    onPress={() => router.back()}
                />
                <View style={styles.headerTitle}>
                    <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
                        Health Assistant
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        Powered by AI
                    </Text>
                </View>
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={
                        <IconButton
                            icon="dots-vertical"
                            size={24}
                            onPress={() => setMenuVisible(true)}
                        />
                    }
                >
                    <Menu.Item onPress={handleStartNewChat} title="Start New Chat" leadingIcon="plus" />
                </Menu>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                {/* Messages */}
                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={[...messages].reverse()}
                    inverted
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messagesList}
                    // onContentSizeChange removed as inverted handles it
                    ListHeaderComponent={
                        isLoading ? (
                            <View style={styles.loadingContainer}>
                                <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
                                    <MaterialCommunityIcons name="robot" size={20} color={theme.colors.primary} />
                                </View>
                                <Surface style={[styles.loadingBubble, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                                    <ActivityIndicator size="small" color={theme.colors.primary} />
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: tokens.spacing.sm }}>
                                        Thinking...
                                    </Text>
                                </Surface>
                            </View>
                        ) : null
                    }
                />

                {/* Suggested Questions (only show if no user messages yet) */}
                {/* {messages.length === 1 && (
                    <View style={styles.suggestionsContainer}>
                        <Text variant="labelMedium" style={[styles.suggestionsTitle, { color: theme.colors.onSurfaceVariant }]}>
                            {loadingSuggestions ? 'Generating suggestions...' : 'Try asking:'}
                        </Text>
                        {loadingSuggestions ? (
                            <ActivityIndicator style={{ marginTop: 10 }} size="small" />
                        ) : (
                            <View style={styles.suggestionsGrid}>
                                {(suggestedQuestions.length > 0 ? suggestedQuestions : fallbackQuestions).map((question, index) => (
                                    <Surface
                                        key={index}
                                        style={[
                                            styles.suggestionChip,
                                            {
                                                backgroundColor: theme.colors.surface,
                                                borderColor: theme.colors.outline,
                                                borderWidth: 1,
                                                borderRadius: 20, // increased for pill shape
                                                overflow: 'hidden'
                                            }
                                        ]}
                                        elevation={0}
                                    >
                                        <TouchableRipple
                                            onPress={() => handleSend(question)}
                                            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                                        >
                                            <Text
                                                variant="labelLarge"
                                                style={{
                                                    color: theme.colors.onSurfaceVariant,
                                                    flexWrap: 'wrap',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {question}
                                            </Text>
                                        </TouchableRipple>
                                    </Surface>
                                ))}
                            </View>
                        )}
                    </View>
                )} */}

                {/* Input */}
                {/* Input */}
                <Surface style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <IconButton
                        icon={isVoiceMode ? "keyboard" : "microphone"}
                        size={24}
                        onPress={() => setIsVoiceMode(!isVoiceMode)}
                        disabled={isLoading || isTranscribing}
                    />

                    {isVoiceMode ? (
                        <TouchableRipple
                            onPressIn={startRecording}
                            onPressOut={stopRecording}
                            disabled={isLoading || isTranscribing}
                            style={[
                                styles.voiceButton,
                                recording ? { backgroundColor: theme.colors.errorContainer } : { backgroundColor: theme.colors.surfaceVariant }
                            ]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                {recording && <ActivityIndicator size="small" color={theme.colors.error} style={{ marginRight: 8 }} />}
                                <Text variant="labelLarge" style={{ color: recording ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant }}>
                                    {isTranscribing ? "Transcribing..." : recording ? "Recording... Release to stop" : "Long press to talk"}
                                </Text>
                            </View>
                        </TouchableRipple>
                    ) : (
                        <RNTextInput
                            ref={inputRef}
                            style={[styles.input, { color: theme.colors.onSurface }]}
                            placeholder="Ask about your health..."
                            placeholderTextColor={theme.colors.onSurfaceVariant}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={1000}
                        />
                    )}

                    {!isVoiceMode && (
                        <IconButton
                            icon="send"
                            mode="contained"
                            size={24}
                            onPress={() => handleSend()}
                            disabled={!inputText.trim() || isLoading}
                            style={{ backgroundColor: inputText.trim() ? theme.colors.primary : theme.colors.surfaceVariant }}
                            iconColor={inputText.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                        />
                    )}
                </Surface>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    headerTitle: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    messagesList: {
        padding: tokens.spacing.lg,
        paddingBottom: tokens.spacing.md,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: tokens.spacing.md,
        alignItems: 'flex-end',
    },
    userMessageContainer: {
        justifyContent: 'flex-end',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: tokens.spacing.sm,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: tokens.radius.lg,
    },
    messageText: {
        lineHeight: 22,
    },
    sourcesContainer: {
        marginTop: tokens.spacing.sm,
        paddingTop: tokens.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    sourceChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: tokens.spacing.xs,
        gap: tokens.spacing.xs,
    },
    sourceChip: {
        height: 24,
    },
    sourceChipText: {
        fontSize: 10,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: tokens.spacing.md,
    },
    loadingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: tokens.spacing.md,
        borderRadius: tokens.radius.lg,
    },
    suggestionsContainer: {
        paddingHorizontal: tokens.spacing.lg,
        paddingBottom: tokens.spacing.md,
    },
    suggestionsTitle: {
        marginBottom: tokens.spacing.sm,
    },
    suggestionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: tokens.spacing.sm,
    },
    suggestionChip: {
        marginBottom: tokens.spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center', // Align inputs and icons vertically
        paddingHorizontal: tokens.spacing.lg,
        paddingVertical: tokens.spacing.md, // Increased vertical padding
        paddingBottom: tokens.spacing.xl, // Lift the whole footer higher
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    input: {
        flex: 1,
        maxHeight: 100,
        paddingHorizontal: tokens.spacing.md,
        paddingVertical: tokens.spacing.sm,
        fontSize: 15, // Slightly bigger
    },
    voiceButton: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: tokens.spacing.sm,
    },
});
