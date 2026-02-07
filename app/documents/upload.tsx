import { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, DeviceEventEmitter, Keyboard } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, ActivityIndicator, ProgressBar, RadioButton, TextInput, HelperText, Portal, Dialog, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { getCurrentUser, transcribeAudio, generateSpeech } from '../../src/services/api';


type DocumentType = 'prescription' | 'test_result' | 'discharge_summary' | 'doctor_notes' | 'health_metrics';

const documentTypes: { value: DocumentType; label: string; icon: string; description: string }[] = [
    { value: 'prescription', label: 'Prescription', icon: 'pill', description: 'Medication labels or Rx papers' },
    { value: 'test_result', label: 'Test Result', icon: 'test-tube', description: 'Lab work, blood tests, etc.' },
    { value: 'discharge_summary', label: 'Discharge Summary', icon: 'hospital-building', description: 'Hospital discharge papers' },
    { value: 'doctor_notes', label: 'Doctor Notes', icon: 'file-document', description: 'Visit notes, instructions' },
    { value: 'health_metrics', label: 'Health Metrics', icon: 'heart-pulse', description: 'BP, glucose, etc. from devices' },
];

export default function UploadScreen() {
    const theme = useTheme();
    const router = useRouter();

    const [image, setImage] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    // Determine document ID reliably
    const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

    const [processingResult, setProcessingResult] = useState<{
        type?: string;
        summary?: string;
        medicationsExtracted?: number;
        metricsExtracted?: number;
        extractedData?: any;
        medications?: any[]; // Allow for top-level medications
    } | null>(null);
    const [step, setStep] = useState<'select' | 'camera' | 'describe' | 'uploading' | 'summary' | 'review' | 'success'>('select');



    // UI State for Modals
    const [editingItem, setEditingItem] = useState<{ type: 'medication' | 'metric' | 'body_condition' | 'bodily_excretion' | 'todo' | 'document_summary', index: number } | null>(null);

    const handleEditItem = (item: { type: 'medication' | 'metric' | 'body_condition' | 'bodily_excretion' | 'todo' | 'document_summary', index: number } | null) => {
        stopSpeaking();
        setEditingItem(item);
    };

    // Description State
    const [userDescription, setUserDescription] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isTranscribing, setIsTranscribing] = useState(false);

    // Medication Review State
    const [reviewMeds, setReviewMeds] = useState<any[]>([]);

    // Metrics Review State
    const [reviewMetrics, setReviewMetrics] = useState<any[]>([]);

    // Add missing states if they got lost, otherwise just add new ones
    // Note: The previous view showed them missing in the snippet but they exist in the full file usually. 
    // I'll be safe and add the new ones here.
    const [selectedMetricIndex, setSelectedMetricIndex] = useState<number | null>(null); // For metric details modal

    const handleSelectMetric = (index: number | null) => {
        stopSpeaking();
        setSelectedMetricIndex(index);
    };
    const [speakingItemId, setSpeakingItemId] = useState<string | null>(null); // TTS state

    // Body Conditions Review State
    const [reviewBodyConditions, setReviewBodyConditions] = useState<any[]>([]);
    const [reviewBodilyExcretions, setReviewBodilyExcretions] = useState<any[]>([]);
    const [reviewTodos, setReviewTodos] = useState<any[]>([]);

    // Todo Editing State
    const [editTodoTitle, setEditTodoTitle] = useState('');
    const [editTodoDescription, setEditTodoDescription] = useState('');
    const [editTodoFrequency, setEditTodoFrequency] = useState('');
    const [editTodoDuration, setEditTodoDuration] = useState('');
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    const [isSaving, setIsSaving] = useState(false);
    const currentSoundRef = useRef<any>(null);

    // Stop any playing audio
    const stopSpeaking = useCallback(async () => {
        if (currentSoundRef.current) {
            try {
                await currentSoundRef.current.stopAsync();
                await currentSoundRef.current.unloadAsync();
            } catch (e) {
                console.log('Error stopping sound:', e);
            }
            currentSoundRef.current = null;
        }
        setSpeakingItemId(null);
    }, []);

    // Stop speaking when screen loses focus (e.g. clicking "Ask AI" or navigating away)
    useFocusEffect(
        useCallback(() => {
            return () => {
                stopSpeaking();
            };
        }, [stopSpeaking])
    );

    // Listen for global stop speaking events (e.g. from footer)
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('STOP_SPEAKING', () => {
            stopSpeaking();
        });
        return () => {
            subscription.remove();
        };
    }, [stopSpeaking]);

    // Auto-trigger upload when step changes to 'uploading'
    useEffect(() => {
        if (step === 'uploading' && image && !isUploading) {
            handleUpload();
        }
    }, [step, image]);

    const pickImage = useCallback(async (source: 'camera' | 'library') => {
        await stopSpeaking();
        try {
            let result;

            if (source === 'camera') {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) {
                    alert('Camera permission is required');
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    quality: 0.8,
                });
            } else {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!permission.granted) {
                    alert('Photo library permission is required');
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    quality: 0.8,
                });
            }

            if (!result.canceled && result.assets[0]) {
                setImage(result.assets[0].uri);
                setStep('describe'); // Go to description step instead of straight to uploading
            }
        } catch (error) {
            console.error('Error picking image:', error);
            alert('Failed to pick image');
        }
    }, []);

    // TTS for metrics
    // TTS for metrics - Modified to use speakText
    const speakMetricDetails = async (metric: any, id: string) => {
        // Calculate status string
        const rangeStatus = calculateRangeStatus(parseFloat(metric.value), metric.normalRangeLower, metric.normalRangeUpper);
        let statusText = '';
        if (rangeStatus === 'normal') statusText = 'is within normal range';
        if (rangeStatus === 'high') statusText = 'is higher than normal';
        if (rangeStatus === 'low') statusText = 'is lower than normal';

        const textToSpeak = [
            `Metric: ${metric.name}`,
            `Value: ${metric.value} ${metric.unit}`,
            statusText,
            metric.summary ? `Summary: ${metric.summary}` : ''
        ].filter(Boolean).join('. ');

        speakText(textToSpeak, id);
    };


    const calculateRangeStatus = (value: number, lower: number | null, upper: number | null) => {
        if (typeof value !== 'number' || isNaN(value)) return null;
        if (lower === null && upper === null) return null;

        if (lower !== null && value < lower) return 'low';
        if (upper !== null && value > upper) return 'high';
        if ((lower === null || value >= lower) && (upper === null || value <= upper)) return 'normal';
        return null;
    };

    // Audio Recording Functions
    async function startRecording() {
        await stopSpeaking();
        try {
            console.log('Requesting permissions..');
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                alert('Microphone permission required');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('Starting recording..');
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    }

    async function stopRecording() {
        console.log('Stopping recording..');
        setRecording(null);
        setIsRecording(false);
        try {
            if (!recording) return;
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            console.log('Recording stopped and stored at', uri);
            if (uri) {
                transcribeRecording(uri);
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function transcribeRecording(uri: string) {
        setIsTranscribing(true);
        try {
            const base64Audio = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });
            const result = await transcribeAudio(base64Audio);
            if (result && result.text) {
                setUserDescription(prev => (prev ? prev + ' ' + result.text : result.text));
            }
        } catch (error) {
            console.error('Transcription failed:', error);
            alert('Failed to transcribe audio.');
        } finally {
            setIsTranscribing(false);
        }
    }

    const handleUpload = async () => {
        if (!image) return;

        setIsUploading(true);
        setUploadProgress(0.1);

        try {
            const { uploadDocument, processDocument } = await import('../../src/services/api');

            // Step 1: Upload to Supabase Storage
            setUploadProgress(0.2);
            const fileName = `document_${Date.now()}.jpg`;
            const { documentId, storagePath } = await uploadDocument(
                { uri: image, name: fileName, type: 'image/jpeg' },
                'other'
            );

            // Store ID immediately
            setUploadedDocId(documentId);

            // Step 2: Process document with Edge Function
            setUploadProgress(0.5);
            console.log('Calling processDocument...');
            const result = await processDocument(documentId, storagePath, userDescription);

            setUploadProgress(1);
            setProcessingResult(result);
            setIsUploading(false);

            // Update image to point to the processed version (with overlay)
            // Add timestamp to force refresh since backend overwrites the file
            if (supabase) {
                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(storagePath);
                setImage(`${publicUrl}?t=${Date.now()}`);
            }

            console.log('Processed result:', JSON.stringify(result, null, 2));

            // Check if medications were extracted or if it's a prescription
            // Handle multiple possible response structures from AI
            const extractedMeds =
                result.extractedData?.prescription?.medications ||
                result.extractedData?.medications ||
                result.medications ||
                [];
            if (result.extractedData?.todos) {
                setReviewTodos(result.extractedData.todos.map((t: any) => ({
                    ...t,
                    frequencyDays: t.frequencyDays || null,
                    durationDays: 120 // Default to 120 days as requested
                })));
            }
            const docType =
                result.extractedData?.documentType ||
                result.extractedData?.type ||
                result.type ||
                'other';

            const extractedMetrics =
                result.extractedData?.metrics ||
                result.metrics ||
                [];

            const extractedBodyConditions = result.extractedData?.bodyConditions || [];
            const extractedBodilyExcretions = result.extractedData?.bodilyExcretions || [];
            const contentLabels = result.extractedData?.contentLabels || [];

            console.log('=== MEDICATION EXTRACTION DEBUG ===');
            console.log('Document type:', docType);
            console.log('result.extractedData:', JSON.stringify(result.extractedData, null, 2));
            console.log('extractedMeds.length:', extractedMeds.length);
            console.log('extractedMetrics.length:', extractedMetrics.length);
            console.log('extractedBodyConditions.length:', extractedBodyConditions.length);
            console.log('extractedBodilyExcretions.length:', extractedBodilyExcretions.length);

            // Process ALL types simultaneously
            const newReviewMeds = [];
            if (extractedMeds.length > 0) {
                const meds = extractedMeds.map((m: any) => ({
                    ...m,
                    quantity: m.quantity ? String(m.quantity) : '',
                    frequency: m.frequencyHours ? String(m.frequencyHours) : '',
                    duration: m.durationDays ? String(m.durationDays) : '',
                    indication: m.indication || '',
                    precaution: m.precaution || '',
                    monitoringRecommendation: m.monitoring_recommendation || m.monitoringRecommendation || '',
                    summary: m.summary || result.extractedData?.summary || result.summary || '',
                    schedule: m.schedule || null,
                    endDate: m.endDate || null
                }));
                newReviewMeds.push(...meds);
            } else if (docType === 'prescription') {
                // Fallback for empty prescription type
                newReviewMeds.push({
                    name: '',
                    dosage: '',
                    frequency: '',
                    duration: '',
                    instructions: '',
                    quantity: '',
                    indication: '',
                    precaution: '',
                    monitoringRecommendation: '',
                    schedule: null,
                    endDate: null
                });
            }
            setReviewMeds(newReviewMeds);

            const newReviewMetrics = [];
            if (extractedMetrics.length > 0) {
                const metrics = extractedMetrics.map((m: any) => ({
                    ...m,
                    value: m.value ? String(m.value) : '',
                    recordedAt: m.recordedAt || new Date().toISOString(),
                    summary: m.summary || result.extractedData?.summary || result.summary || ''
                }));
                newReviewMetrics.push(...metrics);
            } else if (docType.includes('health') || docType.includes('test')) {
                newReviewMetrics.push({
                    name: '',
                    value: '',
                    unit: '',
                    recordedAt: new Date().toISOString(),
                    summary: '',
                    measurementPrecautions: '',
                    monitoringGuidance: '',
                    normalRangeLower: null,
                    normalRangeUpper: null,
                    rangeStatus: null
                });
            }
            setReviewMetrics(newReviewMetrics);

            const newReviewConditions = [];
            if (extractedBodyConditions.length > 0) {
                const conditions = extractedBodyConditions.map((c: any) => ({
                    ...c,
                    observedAt: c.observedAt || new Date().toISOString(),
                    summary: c.summary || result.extractedData?.summary || result.summary || ''
                }));
                newReviewConditions.push(...conditions);
            } else if (contentLabels.includes('body_condition') && docType === 'body_condition') { // Only add empty if explicitly classified as primary
                newReviewConditions.push({
                    bodyLocation: '',
                    conditionType: '',
                    summary: 'New Condition',
                    observedAt: new Date().toISOString()
                });
            }
            setReviewBodyConditions(newReviewConditions);

            const newReviewExcretions = [];
            if (extractedBodilyExcretions.length > 0) {
                const excretions = extractedBodilyExcretions.map((e: any) => ({
                    ...e,
                    observedAt: e.observedAt || e.observed_at || new Date().toISOString(),
                    summary: e.summary || result.extractedData?.summary || result.summary || ''
                }));
                newReviewExcretions.push(...excretions);
            }
            setReviewBodilyExcretions(newReviewExcretions);

            // Extract Todos
            const extractedTodos = result.extractedData?.todos || result.todos || [];
            const newReviewTodos = [];
            if (extractedTodos.length > 0) {
                const todos = extractedTodos.map((t: any) => ({
                    ...t,
                    summary: t.summary || '',
                    dueDate: t.dueDate || null,
                    priority: t.priority || 'medium'
                }));
                newReviewTodos.push(...todos);
            }
            setReviewTodos(newReviewTodos);

            // Transition to Summary step to show what was found
            setStep('summary');

        } catch (error: any) {
            console.error('Upload error:', error);
            alert('Failed to upload document. Please try again.');
            setIsUploading(false);
            setStep('select');
        }
    };

    // Updated Helper Functions
    const handleUpdateMed = (index: number, field: string, value: string) => {
        const updatedMeds = [...reviewMeds];
        updatedMeds[index] = { ...updatedMeds[index], [field]: value };

        // If frequency, quantity, or duration changes, invalidate the AI-provided schedule
        // to force recalculation based on new parameters
        if (['frequency', 'duration'].includes(field)) {
            updatedMeds[index].schedule = null;
        }

        setReviewMeds(updatedMeds);
    };

    const handleAddMed = () => {
        stopSpeaking();
        setReviewMeds([...reviewMeds, {
            name: '',
            dosage: '',
            frequency: '',
            duration: '',
            quantity: '',
            indication: '',
            schedule: null,
            endDate: null
        }]);
    };

    const handleRemoveMed = (index: number) => {
        stopSpeaking();
        const updated = [...reviewMeds];
        updated.splice(index, 1);
        setReviewMeds(updated);
    };

    // Metrics Helpers
    const handleUpdateMetric = (index: number, field: string, value: string) => {
        const updated = [...reviewMetrics];
        updated[index] = { ...updated[index], [field]: value };
        setReviewMetrics(updated);
    };

    const handleAddMetric = () => {
        stopSpeaking();
        setReviewMetrics([...reviewMetrics, { name: '', value: '', unit: '', recordedAt: new Date().toISOString() }]);
    };

    const handleRemoveMetric = (index: number) => {
        stopSpeaking();
        const updated = [...reviewMetrics];
        updated.splice(index, 1);
        setReviewMetrics(updated);
    };

    const handleUpdateBodyCondition = (index: number, field: string, value: string) => {
        const updated = [...reviewBodyConditions];
        updated[index] = { ...updated[index], [field]: value };
        setReviewBodyConditions(updated);
    };

    const handleUpdateTodo = (index: number, field: string, value: string) => {
        const updated = [...reviewTodos];
        updated[index] = { ...updated[index], [field]: value };
        setReviewTodos(updated);
    };

    const handleAddTodo = () => {
        stopSpeaking();
        setReviewTodos([...reviewTodos, {
            title: '',
            description: '',
            priority: 'medium',
            dueDate: null
        }]);
    };

    const handleRemoveTodo = (index: number) => {
        stopSpeaking();
        const updated = [...reviewTodos];
        updated.splice(index, 1);
        setReviewTodos(updated);
    };

    const handleConfirmReview = async () => {
        await stopSpeaking();
        setIsSaving(true);
        if (!supabase) {
            alert('Database connection error');
            setIsSaving(false);
            return;
        }
        try {
            // Use the reliable state variable
            const documentId = uploadedDocId;
            const user = await getCurrentUser();
            const userId = user?.id;

            if (!userId) throw new Error('User not authenticated (Missing User ID)');
            if (!documentId) throw new Error('Document not found (Missing Document ID)');

            // Calculate Tomorrow for start date
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const tomorrowIsoDate = tomorrow.toISOString().split('T')[0];

            // Prepare medications for insertion
            const medsToInsert = reviewMeds.map(med => ({
                user_id: userId,
                document_id: documentId,
                name: med.name || 'Unknown Medication',
                dosage: med.dosage || '',
                frequency: med.frequency ? (parseInt(med.frequency) || null) : null,
                instructions: med.instructions || '',
                quantity: med.quantity ? (parseFloat(med.quantity) || null) : null,
                duration_days: med.duration ? (parseInt(med.duration) || null) : null,
                schedule: null, // We don't save the raw schedule array to DB column 'schedule' unless schema supports it. Usually we generate events.
                end_date: med.endDate || null,
                is_active: true,
                start_date: tomorrowIsoDate, // Start Tomorrow per user request
                indication: med.indication || null,
                precaution: med.precaution || null,
                monitoring_recommendation: med.monitoringRecommendation || null,
                summary: med.summary || null, // Added summary field
            })) as any[];

            // Insert medications
            const { data: insertedMeds, error: medError } = await supabase
                .from('medications')
                .insert(medsToInsert as any)
                .select() as any;

            if (medError) throw medError;

            // Metrics Insertion
            if (reviewMetrics.length > 0) {
                const metricsToInsert = reviewMetrics.map(m => ({
                    user_id: userId,
                    source_document_id: documentId,
                    metric_type: m.name,
                    value: parseFloat(m.value) || 0,
                    unit: m.unit,
                    recorded_at: m.recordedAt,
                    summary: m.summary || null, // Save summary
                    measurement_precautions: m.measurementPrecautions || null,
                    monitoring_guidance: m.monitoringGuidance || null,
                    normal_range_lower: m.normalRangeLower || null,
                    normal_range_upper: m.normalRangeUpper || null,
                    range_status: calculateRangeStatus(parseFloat(m.value), m.normalRangeLower, m.normalRangeUpper)
                }));
                const { error: metricError } = await supabase.from('health_metrics').insert(metricsToInsert as any);
                if (metricError) throw metricError;
            }

            // Body Conditions Insertion
            if (reviewBodyConditions.length > 0) {
                const conditionsToInsert = reviewBodyConditions.map(c => ({
                    user_id: userId,
                    document_id: documentId,
                    body_location: c.bodyLocation || c.body_location || 'unknown',
                    condition_type: c.conditionType || c.condition_type,
                    color_depth: c.colorDepth ?? c.color_depth ?? null,
                    size: c.size ?? null,
                    observed_at: c.observedAt || c.observed_at || new Date().toISOString(),
                    summary: c.summary || null,
                    possible_condition: c.possibleCondition || null,
                    possible_cause: c.possibleCause || null,
                    care_advice: c.careAdvice || null,
                    precautions: c.precautions || null,
                    when_to_seek_care: c.whenToSeekCare || null,
                    label: c.label || null,
                    progression_status: c.progressionStatus || 'initial',
                }));
                const { error: conditionError } = await supabase.from('body_conditions').insert(conditionsToInsert as any);
                if (conditionError) throw conditionError;
            }

            // Bodily Excretions Insertion
            if (reviewBodilyExcretions.length > 0) {
                const excretionsToInsert = reviewBodilyExcretions.map(e => ({
                    user_id: userId,
                    document_id: documentId,
                    excretion_type: e.excretionType || e.excretion_type || 'other',
                    color: e.color,
                    consistency: e.consistency,
                    volume_ml: e.volumeMl || e.volume_ml,
                    frequency_per_day: e.frequencyPerDay || e.frequency_per_day,
                    blood_present: e.bloodPresent || e.blood_present || false,
                    pain_level: e.painLevel || e.pain_level,
                    abnormality_indicators: e.abnormalityIndicators || e.abnormality_indicators || [],
                    notes: e.notes,
                    observed_at: e.observedAt || e.observed_at || new Date().toISOString(),
                    summary: e.summary || null, // Save summary
                }));
                const { error: excretionError } = await supabase.from('bodily_excretions').insert(excretionsToInsert as any);
                if (excretionError) throw excretionError;
            }

            // Todos Insertion (into todo_items AND calendar_events)
            if (reviewTodos.length > 0) {
                // 1. Insert into todo_items
                const todosToInsert = reviewTodos.map(t => ({
                    user_id: userId,
                    document_id: documentId,
                    title: t.title || 'New Task',
                    description: t.description || t.summary,
                    priority: 'medium',
                    due_date: new Date().toISOString().split('T')[0], // Default to today as start date
                    scheduled_datetime: new Date().toISOString(),
                    completed: false,
                    frequency_days: t.frequencyDays ? parseInt(t.frequencyDays) : null,
                    duration_days: t.durationDays ? parseInt(t.durationDays) : 120 // Default 120
                }));

                const { data: insertedTodos, error: todoError } = await supabase
                    .from('todo_items')
                    .insert(todosToInsert as any)
                    .select();

                if (todoError) throw todoError;

                // 2. Create corresponding calendar events
                if (insertedTodos && insertedTodos.length > 0) {
                    const calendarEvents: any[] = [];

                    // Iterate inserted todos to generate events
                    (insertedTodos as any[]).forEach((todo) => {
                        const startDate = new Date(); // Now
                        const durationDays = todo.duration_days || 1;
                        const frequencyDays = todo.frequency_days;

                        if (frequencyDays) {
                            // Generate events based on day interval
                            // frequencyDays = 1 (Daily), 7 (Weekly), etc.

                            // Calculate end date
                            const endDate = new Date(startDate);
                            endDate.setDate(endDate.getDate() + durationDays);

                            let currentDate = new Date(startDate);
                            // Start from today or tomorrow?
                            // User: "start day ... should be the date the photo is uploaded" -> Today.

                            // Loop until we exceed duration/end date
                            let dayCount = 0;
                            while (dayCount < durationDays) {
                                calendarEvents.push({
                                    user_id: userId,
                                    document_id: documentId,
                                    todo_item_id: todo.id,
                                    title: todo.title,
                                    description: todo.description,
                                    type: 'todo',
                                    source_type: 'todo',
                                    scheduled_at: currentDate.toISOString(),
                                    duration_minutes: 30,
                                    completed: false
                                });

                                // Increment by frequency
                                currentDate.setDate(currentDate.getDate() + frequencyDays);
                                dayCount += frequencyDays;
                            }
                        }
                        // ELSE: Do NOT create calendar events if no frequency (User Request)
                    });

                    if (calendarEvents.length > 0) {
                        const { error: calError } = await supabase
                            .from('calendar_events')
                            .insert(calendarEvents as any);

                        if (calError) console.error('Error creating calendar events for todos:', calError);
                    }
                }
            }

            // Generate Calendar Schedule
            if (insertedMeds && insertedMeds.length > 0) {
                const calendarEvents: any[] = [];

                console.log(`=== CALENDAR SCHEDULING (Starting ${tomorrowIsoDate}) ===`);

                // We iterate using the original reviewMeds to access the AI 'schedule' if valid
                // CAUTION: Assumes insertedMeds matches index order of reviewMeds
                insertedMeds.forEach((med: any, index: number) => {
                    const originalMed = reviewMeds[index];

                    // Strategy 1: Use AI-provided schedule if available and not invalidated
                    if (originalMed.schedule && Array.isArray(originalMed.schedule) && originalMed.schedule.length > 0) {
                        console.log(`Using AI schedule for ${med.name} (${originalMed.schedule.length} events)`);

                        // Filter out events before Tomorrow
                        const validEvents = originalMed.schedule.filter((isoString: string) => {
                            const eventDate = new Date(isoString);
                            return eventDate >= tomorrow;
                        });

                        console.log(`Filtered ${originalMed.schedule.length - validEvents.length} past events. scheduling ${validEvents.length} future events.`);

                        validEvents.forEach((isoString: string) => {
                            calendarEvents.push({
                                user_id: userId,
                                document_id: documentId,
                                medication_id: med.id,
                                title: `💊 ${med.name} ${med.dosage || ''}`.trim(),
                                description: `Take medication`,
                                type: 'medication',
                                scheduled_at: isoString,
                                duration_minutes: 15,
                                completed: false,
                            });
                        });
                        return; // Continue to next med
                    }

                    // Strategy 2: Fallback to simple frequency loop
                    // med.frequency is now an integer representing hours, OR null
                    if (!med.frequency) {
                        console.log(`Skipping ${med.name}: no frequency set and no AI schedule`);
                        return;
                    }

                    const intervalHours = med.frequency;
                    const durationDays = med.duration_days || 7;

                    console.log(`Scheduling ${med.name}: every ${intervalHours}h for ${durationDays} days`);

                    const eventTimes: number[] = [];
                    // Start at 00:00 (Midnight)
                    let currentHour = 0;
                    while (currentHour < 24) {
                        eventTimes.push(currentHour);
                        currentHour += intervalHours;
                    }

                    console.log(`Daily times: ${eventTimes.map(h => `${h}:00`).join(', ')}`);

                    // Create events for duration_days, starting from Tomorrow
                    for (let day = 0; day < durationDays; day++) {
                        const eventDate = new Date(tomorrow);
                        eventDate.setDate(eventDate.getDate() + day);

                        for (const hour of eventTimes) {
                            const eventDateTime = new Date(eventDate);
                            eventDateTime.setHours(hour, 0, 0, 0);
                            calendarEvents.push({
                                user_id: userId,
                                document_id: documentId,
                                medication_id: med.id,
                                title: `💊 ${med.name} ${med.dosage || ''}`.trim(),
                                description: `Take medication - Every ${intervalHours} hours`,
                                type: 'medication',
                                scheduled_at: eventDateTime.toISOString(),
                                duration_minutes: 15,
                                completed: false,
                            });
                        }
                    }
                });

                console.log(`Total calendar events to create: ${calendarEvents.length}`);

                if (calendarEvents.length > 0) {
                    const { error: calError } = await supabase.from('calendar_events').insert(calendarEvents as any);
                    if (calError) {
                        console.error('Failed to create calendar events:', calError);
                    } else {
                        console.log('Calendar events created successfully!');
                    }
                }
            }

            setStep('success');
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Failed to save data: ' + (error as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDone = () => {
        // Since we support mixed uploads, default to documents list, but prioritize specific tabs if only 1 type
        let target = '/documents/list';

        // Improve specific redirection
        const hasMeds = reviewMeds.length > 0;
        const hasMetrics = reviewMetrics.length > 0;
        const hasConditions = reviewBodyConditions.length > 0 || reviewBodilyExcretions.length > 0;

        if (hasMeds && !hasMetrics && !hasConditions) target = '/(tabs)/medications';
        else if (hasMetrics && !hasMeds && !hasConditions) target = '/(tabs)/health';
        else if (hasConditions && !hasMeds && !hasMetrics) target = '/(tabs)/body-conditions';

        router.dismissAll();
        router.replace(target as any);
    };

    const handleUploadAnother = () => {
        stopSpeaking();
        setImage(null);
        setSelectedType(null);
        setUploadProgress(0);
        setUserDescription(''); // Reset description
        setStep('select');
        setReviewMeds([]);
        setReviewMetrics([]);
        setReviewBodyConditions([]);
        setReviewBodilyExcretions([]);
        setReviewTodos([]);
        setUploadedDocId(null); // Reset ID
    };



    const speakText = async (text: string, id: string) => {
        if (!text) return;

        if (speakingItemId === id) {
            stopSpeaking();
            return;
        }

        if (speakingItemId) {
            await stopSpeaking();
        }

        setSpeakingItemId(id);
        setIsUploading(true); // Reuse loading state for spinner if needed, or create new one
        try {
            const { audioContent } = await generateSpeech(text); // Destructure audioContent
            const uri = FileSystem.documentDirectory + 'speech.mp3';
            await FileSystem.writeAsStringAsync(uri, audioContent, { encoding: FileSystem.EncodingType.Base64 });
            const { sound } = await Audio.Sound.createAsync({ uri });
            currentSoundRef.current = sound;
            await sound.playAsync();
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setSpeakingItemId(null);
                }
            });
        } catch (error) {
            console.error('TTS Error:', error);
            alert('Failed to generate speech');
            setSpeakingItemId(null);
        } finally {
            setIsUploading(false);
        }
    };



    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Stack.Screen options={{ title: step === 'review' ? 'Verify Details' : 'Upload Document' }} />

            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 48 }}>
                    {step !== 'success' && (
                        <IconButton
                            icon="arrow-left"
                            size={24}
                            onPress={() => router.back()}
                        />
                    )}
                </View>
                <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1, textAlign: 'center' }}>
                    {step === 'review' ? 'Verify Details' : 'Upload'}
                </Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {step === 'select' && (
                    <>
                        <Text variant="bodyLarge" style={[styles.instruction, { color: theme.colors.onSurfaceVariant }]}>
                            Upload a photo of your medication, health metric, or medical document.
                        </Text>
                        <View style={styles.uploadOptions}>
                            <Card style={styles.uploadCard} mode="outlined" onPress={() => pickImage('camera')}>
                                <Card.Content style={styles.uploadCardContent}>
                                    <View style={[styles.uploadIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <MaterialCommunityIcons name="camera" size={32} color={theme.colors.primary} />
                                    </View>
                                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>Take Photo</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Use your camera</Text>
                                </Card.Content>
                            </Card>
                            <Card style={styles.uploadCard} mode="outlined" onPress={() => pickImage('library')}>
                                <Card.Content style={styles.uploadCardContent}>
                                    <View style={[styles.uploadIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                                        <MaterialCommunityIcons name="image" size={32} color={theme.colors.secondary} />
                                    </View>
                                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>Choose Photo</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>From your gallery</Text>
                                </Card.Content>
                            </Card>
                        </View>
                    </>
                )}

                {step === 'describe' && image && (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                        <Text variant="headlineSmall" style={{ textAlign: 'center', marginBottom: 16 }}>Describe the Photo</Text>

                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <Image source={{ uri: image }} style={{ width: 200, height: 200, borderRadius: 12, resizeMode: 'cover' }} />
                        </View>



                        <TextInput
                            label="Description"
                            value={userDescription}
                            onChangeText={setUserDescription}
                            mode="outlined"
                            multiline
                            style={[styles.input, { minHeight: 100 }]}
                            placeholder="e.g. 'This rash appeared yesterday after hiking...'"
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 20, gap: 20 }}>
                            <Button
                                mode={isRecording ? "contained" : "outlined"}
                                onPressIn={startRecording}
                                onPressOut={stopRecording}
                                icon={isRecording ? "stop" : "microphone"}
                                buttonColor={isRecording ? theme.colors.error : undefined}
                                disabled={isTranscribing}
                            >
                                {isRecording ? "Release to Send" : "Hold to Record"}
                            </Button>
                            {isTranscribing && <ActivityIndicator size="small" />}
                        </View>

                        <Button
                            mode="contained"
                            onPress={() => setStep('uploading')}
                            style={{ marginTop: 20, paddingVertical: 6 }}
                            loading={isTranscribing}
                            disabled={isTranscribing}
                        >
                            Upload
                        </Button>

                    </KeyboardAvoidingView>
                )}

                {step === 'uploading' && (
                    <View style={styles.uploadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text variant="titleMedium" style={{ marginTop: tokens.spacing.lg }}>Processing...</Text>
                        <ProgressBar progress={uploadProgress} color={theme.colors.primary} style={styles.progressBar} />
                    </View>
                )}

                {step === 'summary' && (
                    <View style={styles.summaryContainer}>
                        <View style={[styles.successIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                            <MaterialCommunityIcons name="clipboard-check" size={48} color={theme.colors.primary} />
                        </View>
                        <Text variant="headlineSmall" style={{ marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.md }}>Analysis Complete</Text>
                        <Text variant="bodyMedium" style={{ textAlign: 'center', marginBottom: tokens.spacing.xl, color: theme.colors.onSurfaceVariant }}>
                            We found the following information in your document:
                        </Text>

                        <View style={styles.summaryStats}>
                            {/* Display Document Type (Prioritized) only if medical_document */}
                            {(processingResult?.type || processingResult?.extractedData?.primaryType) &&
                                processingResult?.extractedData?.contentLabels?.includes('medical_document') && (
                                    <View style={styles.statRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <MaterialCommunityIcons name="file-document" size={20} color={theme.colors.primary} />
                                            <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>
                                                {(
                                                    processingResult?.extractedData?.title ||
                                                    processingResult?.extractedData?.contentLabels?.find((l: string) =>
                                                        !['medical_document', 'other', 'health_metrics'].includes(l)
                                                    ) ||
                                                    processingResult?.extractedData?.primaryType ||
                                                    processingResult?.type ||
                                                    'Document'
                                                ).replace(/_/g, ' ')}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                            {reviewMeds.length > 0 && (
                                <View style={styles.statRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="pill" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyLarge">Medications</Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{reviewMeds.length}</Text>
                                    </View>
                                </View>
                            )}
                            {reviewMetrics.length > 0 && (
                                <View style={styles.statRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="heart-pulse" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyLarge">Health Metrics</Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{reviewMetrics.length}</Text>
                                    </View>
                                </View>
                            )}
                            {reviewBodyConditions.length > 0 && (
                                <View style={styles.statRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="account-injury" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyLarge">Conditions</Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{reviewBodyConditions.length}</Text>
                                    </View>
                                </View>
                            )}
                            {reviewBodilyExcretions.length > 0 && (
                                <View style={styles.statRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="water" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyLarge">Excretions</Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{reviewBodilyExcretions.length}</Text>
                                    </View>
                                </View>
                            )}
                            {reviewTodos.length > 0 && (
                                <View style={styles.statRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyLarge">Tasks</Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{reviewTodos.length}</Text>
                                    </View>
                                </View>
                            )}

                        </View>

                        <Button mode="contained" onPress={() => setStep('review')} style={styles.doneButton}>
                            Verify Details
                        </Button>
                    </View>
                )}

                {
                    step === 'review' && (
                        <View style={{ paddingBottom: 100 }}>




                            {/* Document Summary Card (New) - Only if medical_document */}
                            {(processingResult?.type || processingResult?.extractedData?.primaryType) &&
                                processingResult?.extractedData?.contentLabels?.includes('medical_document') && (
                                    <Card
                                        style={styles.reviewCard}
                                        onPress={() => handleEditItem({ type: 'document_summary', index: 0 })}
                                    >
                                        <Card.Title
                                            title={processingResult?.extractedData?.title || (processingResult?.extractedData?.primaryType || processingResult?.type || 'Document').replace(/_/g, ' ')}
                                            titleNumberOfLines={0}
                                            left={(props) => <MaterialCommunityIcons {...props} name="file-document-outline" />}
                                            right={(props) => (
                                                <IconButton
                                                    {...props}
                                                    icon={speakingItemId === 'doc_summary' ? 'stop' : 'volume-high'}
                                                    iconColor={speakingItemId === 'doc_summary' ? theme.colors.error : undefined}
                                                    onPress={() => {
                                                        const title = processingResult?.extractedData?.title || (processingResult?.extractedData?.primaryType || processingResult?.type || 'Document').replace(/_/g, ' ');
                                                        const summary = processingResult?.summary || processingResult?.extractedData?.summary || 'No summary available.';
                                                        speakText(`${title}. ${summary}`, 'doc_summary');
                                                    }}
                                                />
                                            )}
                                            titleStyle={{ textTransform: 'none' }}
                                        />
                                    </Card>
                                )}
                            {reviewMeds.map((med, index) => (
                                <Card
                                    key={`med-${index}`}
                                    style={styles.reviewCard}
                                    onPress={() => handleEditItem({ type: 'medication', index })}
                                >
                                    <Card.Title
                                        title={med.name || 'Unknown Medication'}
                                        subtitle={med.instructions || 'No instructions available'}
                                        subtitleNumberOfLines={0}
                                        left={(props) => <MaterialCommunityIcons {...props} name="pill" />}
                                        right={(props) => (
                                            <IconButton
                                                {...props}
                                                icon={speakingItemId === `med-${index}` ? 'stop' : 'volume-high'}
                                                iconColor={speakingItemId === `med-${index}` ? theme.colors.error : undefined}
                                                onPress={() => {
                                                    const textToSpeak = [
                                                        med.name,
                                                        med.indication ? `Indication: ${med.indication}` : '',
                                                        med.instructions ? `Instructions: ${med.instructions}` : '',
                                                        med.precaution ? `Precaution: ${med.precaution}` : '',
                                                        med.monitoringRecommendation ? `Monitoring: ${med.monitoringRecommendation}` : ''
                                                    ].filter(Boolean).join('. ');
                                                    speakText(textToSpeak, `med-${index}`);
                                                }}
                                            />
                                        )}
                                    />
                                </Card>
                            ))}

                            {/* Metrics Summary Cards */}
                            {reviewMetrics.map((metric, index) => {
                                const rangeStatus = calculateRangeStatus(parseFloat(metric.value), metric.normalRangeLower, metric.normalRangeUpper);
                                const statusColor = rangeStatus === 'normal' ? '#4CAF50' : (rangeStatus === 'high' || rangeStatus === 'low' ? '#FF9800' : theme.colors.primary);

                                return (
                                    <Card
                                        key={`metric-${index}`}
                                        style={styles.reviewCard}
                                        onPress={() => handleSelectMetric(index)}
                                    >
                                        <Card.Title
                                            title={metric.name || 'New Metric'}
                                            subtitle={`${metric.value} ${metric.unit}`}
                                            left={(props) => <MaterialCommunityIcons {...props} name="heart-pulse" />}
                                            right={(props) => (
                                                <IconButton
                                                    {...props}
                                                    icon={speakingItemId === `metric-${index}` ? 'stop' : 'volume-high'}
                                                    iconColor={speakingItemId === `metric-${index}` ? theme.colors.error : undefined}
                                                    onPress={() => speakMetricDetails(metric, `metric-${index}`)}
                                                />
                                            )}
                                        />
                                        {rangeStatus && (
                                            <Card.Content>
                                                <Text style={{ color: statusColor, fontWeight: 'bold' }}>
                                                    {rangeStatus === 'normal' ? 'Within Normal Range' : (rangeStatus === 'high' ? 'Too High' : 'Too Low')}
                                                </Text>
                                            </Card.Content>
                                        )}
                                    </Card>
                                )
                            })}

                            {/* Conditions Summary Cards */}
                            {reviewBodyConditions.map((condition, index) => (
                                <Card
                                    key={`cond-${index}`}
                                    style={styles.reviewCard}
                                    onPress={() => handleEditItem({ type: 'body_condition', index })}
                                >
                                    <Card.Title
                                        title={condition.conditionType || 'Body Condition'}
                                        subtitle={condition.bodyLocation}
                                        left={(props) => <MaterialCommunityIcons {...props} name="account-injury" />}
                                        right={(props) => (
                                            <IconButton
                                                {...props}
                                                icon={speakingItemId === `cond-${index}` ? 'stop' : 'volume-high'}
                                                iconColor={speakingItemId === `cond-${index}` ? theme.colors.error : undefined}
                                                onPress={() => {
                                                    const textToSpeak = [
                                                        `Name: ${condition.conditionType || 'Unknown condition'}`,
                                                        condition.possibleCondition ? `Possible Condition: ${condition.possibleCondition}` : '',
                                                        condition.possibleCause ? `Possible Cause: ${condition.possibleCause}` : '',
                                                        condition.careAdvice ? `Care Advice: ${condition.careAdvice}` : '',
                                                        condition.precautions ? `Precautions: ${condition.precautions}` : '',
                                                        condition.whenToSeekCare ? `When to Seek Care: ${condition.whenToSeekCare}` : ''
                                                    ].filter(Boolean).join('. ');
                                                    speakText(textToSpeak, `cond-${index}`);
                                                }}
                                            />
                                        )}
                                    />
                                </Card>
                            ))}

                            {/* Excretions Summary Cards */}
                            {reviewBodilyExcretions.map((excretion, index) => (
                                <Card
                                    key={`excr-${index}`}
                                    style={styles.reviewCard}
                                    onPress={() => handleEditItem({ type: 'bodily_excretion', index })}
                                >
                                    <Card.Title
                                        title={excretion.excretionType || 'Bodily Excretion'}
                                        subtitle={excretion.summary || 'Tap to edit details'}
                                        left={(props) => <MaterialCommunityIcons {...props} name="water" />}
                                        right={(props) => <IconButton {...props} icon="pencil" />}
                                    />
                                </Card>
                            ))}

                            {/* Todos Summary Cards */}
                            {reviewTodos.map((todo, index) => (
                                <Card
                                    key={`todo-${index}`}
                                    style={styles.reviewCard}
                                    onPress={() => handleEditItem({ type: 'todo', index })}
                                >
                                    <Card.Title
                                        title={todo.title || 'Task'}
                                        titleNumberOfLines={0}
                                        left={(props) => <MaterialCommunityIcons {...props} name="checkbox-marked-circle-outline" />}
                                        right={(props) => (
                                            <IconButton
                                                {...props}
                                                icon={speakingItemId === `todo-${index}` ? 'stop' : 'volume-high'}
                                                iconColor={speakingItemId === `todo-${index}` ? theme.colors.error : undefined}
                                                onPress={() => {
                                                    const textToSpeak = [
                                                        todo.title,
                                                        todo.description || todo.summary,
                                                        todo.dueDate ? `Due date: ${new Date(todo.dueDate).toLocaleDateString()}` : ''
                                                    ].filter(Boolean).join('. ');
                                                    speakText(textToSpeak, `todo-${index}`);
                                                }}
                                            />
                                        )}
                                    />
                                </Card>
                            ))}

                            <Button
                                mode="contained"
                                onPress={handleConfirmReview}
                                style={styles.confirmButton}
                                loading={isSaving}
                                disabled={isSaving}
                            >
                                Confirm all and Save
                            </Button>
                        </View>
                    )
                }

                {
                    step === 'success' && (
                        <View style={styles.successContainer}>
                            <View style={[styles.successIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                                <MaterialCommunityIcons name="check" size={48} color={theme.colors.secondary} />
                            </View>
                            <Text variant="headlineSmall" style={{ marginTop: tokens.spacing.lg }}>Success!</Text>
                            <Text variant="bodyMedium" style={{ textAlign: 'center', marginVertical: tokens.spacing.md }}>
                                All items have been verified and saved to your health record.
                            </Text>
                            <Button mode="contained" onPress={handleDone} style={styles.doneButton}>
                                Done
                            </Button>
                            <Button mode="outlined" onPress={handleUploadAnother} style={{ marginTop: 12 }}>
                                Upload Another
                            </Button>
                        </View>
                    )
                }
            </ScrollView >

            {/* Edit Modals */}
            <Portal>
                {/* Document Summary Modal */}
                <Dialog visible={editingItem?.type === 'document_summary'} onDismiss={() => handleEditItem(null)} style={{ width: '90%', alignSelf: 'center', borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
                        <IconButton icon="close" size={20} onPress={() => handleEditItem(null)} />
                    </View>
                    <Dialog.Title style={{ paddingRight: 40 }}>
                        {processingResult?.extractedData?.title || (processingResult?.extractedData?.primaryType || processingResult?.type || 'Unknown').replace(/_/g, ' ')}
                    </Dialog.Title>
                    <Dialog.ScrollArea style={{ maxHeight: '80%', paddingHorizontal: 0 }}>
                        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                            <View style={{ marginBottom: 16 }}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Type</Text>
                                <Chip icon="file-document" style={{ alignSelf: 'flex-start' }}>
                                    {(processingResult?.extractedData?.primaryType || processingResult?.type || 'Unknown').replace(/_/g, ' ')}
                                </Chip>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Summary</Text>
                                <Text variant="bodyMedium" style={{ lineHeight: 22 }}>
                                    {processingResult?.summary || processingResult?.extractedData?.summary || 'No summary available.'}
                                </Text>
                            </View>

                            {/* Extracted Counts */}
                            <View style={{ marginBottom: 16 }}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 8 }}>Extracted Items</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {reviewMeds.length > 0 && <Chip icon="pill">{reviewMeds.length} Medications</Chip>}
                                    {reviewMetrics.length > 0 && <Chip icon="heart-pulse">{reviewMetrics.length} Metrics</Chip>}
                                    {reviewTodos.length > 0 && <Chip icon="checkbox-marked-circle-outline">{reviewTodos.length} Tasks</Chip>}
                                    {reviewBodyConditions.length > 0 && <Chip icon="account-injury">{reviewBodyConditions.length} Conditions</Chip>}
                                </View>
                            </View>
                        </ScrollView>
                    </Dialog.ScrollArea>
                </Dialog>

                {/* Medication Modal */}
                <Dialog visible={editingItem?.type === 'medication'} onDismiss={() => handleEditItem(null)} style={{ width: '90%', alignSelf: 'center', borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
                        <IconButton icon="close" size={20} onPress={() => handleEditItem(null)} />
                    </View>
                    <Dialog.Title style={{ paddingRight: 40 }}>
                        {editingItem?.type === 'medication' ? reviewMeds[editingItem.index]?.name || 'Medication' : 'Medication'}
                    </Dialog.Title>
                    <Dialog.ScrollArea style={{ maxHeight: 630, paddingHorizontal: 0 }}>
                        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}>
                            {editingItem?.type === 'medication' && (
                                <View>
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Indication</Text>
                                    {(() => {
                                        const text = reviewMeds[editingItem.index]?.indication || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{text}</Text>;
                                        }
                                        return (
                                            <View style={{ marginBottom: 16 }}>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}

                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Precaution</Text>
                                    {(() => {
                                        const text = reviewMeds[editingItem.index]?.precaution || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{text}</Text>;
                                        }
                                        return (
                                            <View style={{ marginBottom: 16 }}>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}

                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Monitoring</Text>
                                    {(() => {
                                        const text = reviewMeds[editingItem.index]?.monitoringRecommendation || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium">{text}</Text>;
                                        }
                                        return (
                                            <View>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}
                                </View>
                            )}
                        </ScrollView>
                    </Dialog.ScrollArea>
                </Dialog>

                {/* Metric Modal */}
                <Dialog visible={editingItem?.type === 'metric'} onDismiss={() => handleEditItem(null)}>
                    <Dialog.Title>Edit Metric</Dialog.Title>
                    <Dialog.Content>
                        {editingItem?.type === 'metric' && (
                            <>
                                <TextInput
                                    label="Name"
                                    value={reviewMetrics[editingItem.index]?.name}
                                    onChangeText={(t) => handleUpdateMetric(editingItem.index, 'name', t)}
                                    style={styles.input} mode="outlined"
                                />
                                <TextInput
                                    label="Value"
                                    value={reviewMetrics[editingItem.index]?.value}
                                    onChangeText={(t) => handleUpdateMetric(editingItem.index, 'value', t)}
                                    style={styles.input} mode="outlined" keyboardType="numeric"
                                />
                                <TextInput
                                    label="Unit"
                                    value={reviewMetrics[editingItem.index]?.unit}
                                    onChangeText={(t) => handleUpdateMetric(editingItem.index, 'unit', t)}
                                    style={styles.input} mode="outlined"
                                />
                            </>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => {
                            if (editingItem && editingItem.type === 'metric') {
                                handleRemoveMetric(editingItem.index);
                                handleEditItem(null);
                            }
                        }} textColor={theme.colors.error}>Remove</Button>
                        <Button onPress={() => handleEditItem(null)}>Done</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Condition Modal */}
                <Dialog visible={editingItem?.type === 'body_condition'} onDismiss={() => handleEditItem(null)} style={{ width: '90%', alignSelf: 'center', borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
                        <IconButton icon="close" size={20} onPress={() => handleEditItem(null)} />
                    </View>
                    <Dialog.Title style={{ paddingRight: 40 }}>
                        {editingItem?.type === 'body_condition' ? reviewBodyConditions[editingItem.index]?.conditionType || 'Body Condition' : 'Body Condition'}
                    </Dialog.Title>
                    <Dialog.ScrollArea style={{ maxHeight: 630, paddingHorizontal: 0 }}>
                        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}>
                            {editingItem?.type === 'body_condition' && (
                                <View>
                                    {/* Location and Status */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Location</Text>
                                            <Text variant="bodyMedium">{reviewBodyConditions[editingItem.index]?.bodyLocation || 'Unknown'}</Text>
                                        </View>
                                        <View>
                                            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Status</Text>
                                            <Chip style={{
                                                backgroundColor: reviewBodyConditions[editingItem.index]?.progressionStatus === 'improving' ? '#4CAF5020' :
                                                    reviewBodyConditions[editingItem.index]?.progressionStatus === 'worsening' ? '#F4433620' :
                                                        reviewBodyConditions[editingItem.index]?.progressionStatus === 'no_significant_change' ? '#9E9E9E20' : '#2196F320'
                                            }}>
                                                <Text style={{
                                                    color: reviewBodyConditions[editingItem.index]?.progressionStatus === 'improving' ? '#4CAF50' :
                                                        reviewBodyConditions[editingItem.index]?.progressionStatus === 'worsening' ? '#F44336' :
                                                            reviewBodyConditions[editingItem.index]?.progressionStatus === 'no_significant_change' ? '#9E9E9E' : '#2196F3',
                                                    fontWeight: 'bold', textTransform: 'capitalize'
                                                }}>
                                                    {reviewBodyConditions[editingItem.index]?.progressionStatus === 'improving' ? 'Improving' :
                                                        reviewBodyConditions[editingItem.index]?.progressionStatus === 'worsening' ? 'Worsening' :
                                                            reviewBodyConditions[editingItem.index]?.progressionStatus === 'no_significant_change' ? 'No Change' : 'Initial'}
                                                </Text>
                                            </Chip>
                                        </View>
                                    </View>

                                    {/* Possible Condition */}
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Possible Condition</Text>
                                    {(() => {
                                        const text = reviewBodyConditions[editingItem.index]?.possibleCondition || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{text}</Text>;
                                        }
                                        return (
                                            <View style={{ marginBottom: 16 }}>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}

                                    {/* Possible Cause */}
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Possible Cause</Text>
                                    {(() => {
                                        const text = reviewBodyConditions[editingItem.index]?.possibleCause || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{text}</Text>;
                                        }
                                        return (
                                            <View style={{ marginBottom: 16 }}>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}

                                    {/* Care Advice */}
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Care Advice</Text>
                                    {(() => {
                                        const text = reviewBodyConditions[editingItem.index]?.careAdvice || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{text}</Text>;
                                        }
                                        return (
                                            <View style={{ marginBottom: 16 }}>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}

                                    {/* Precautions */}
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Precautions</Text>
                                    {(() => {
                                        const text = reviewBodyConditions[editingItem.index]?.precautions || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{text}</Text>;
                                        }
                                        return (
                                            <View style={{ marginBottom: 16 }}>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}

                                    {/* When to Seek Care */}
                                    <Text variant="labelLarge" style={{ color: theme.colors.error, marginBottom: 4 }}>When to Seek Care</Text>
                                    {(() => {
                                        const text = reviewBodyConditions[editingItem.index]?.whenToSeekCare || 'Not available';
                                        const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                        if (sentences.length <= 1) {
                                            return <Text variant="bodyMedium">{text}</Text>;
                                        }
                                        return (
                                            <View>
                                                {sentences.map((s: string, i: number) => (
                                                    <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                ))}
                                            </View>
                                        );
                                    })()}
                                </View>
                            )}
                        </ScrollView>
                    </Dialog.ScrollArea>
                </Dialog>

                {/* Todo Modal */}
                <Dialog visible={editingItem?.type === 'todo'} onDismiss={() => handleEditItem(null)} style={{ width: '90%', alignSelf: 'center', borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
                        <IconButton icon="close" size={20} onPress={() => handleEditItem(null)} />
                    </View>
                    <Dialog.Title style={{ paddingRight: 40 }}>
                        {editingItem && editingItem.type === 'todo' ? reviewTodos[editingItem.index]?.title : 'Task'}
                    </Dialog.Title>
                    <Dialog.Content>
                        {editingItem?.type === 'todo' && (
                            <>
                                <View style={{ marginBottom: 16 }}>
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Description</Text>
                                    <Text variant="bodyMedium" style={{ lineHeight: 22 }}>
                                        {reviewTodos[editingItem.index]?.description || reviewTodos[editingItem.index]?.summary || 'No description available.'}
                                    </Text>
                                </View>
                            </>
                        )}
                    </Dialog.Content>
                </Dialog>
                {/* Metric Details Modal */}
                <Dialog
                    visible={selectedMetricIndex !== null}
                    onDismiss={() => handleSelectMetric(null)}
                    style={{ width: '90%', alignSelf: 'center', borderRadius: 8 }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
                        <IconButton icon="close" size={20} onPress={() => handleSelectMetric(null)} />
                    </View>
                    <Dialog.Title style={{ paddingRight: 40 }}>
                        {selectedMetricIndex !== null ? reviewMetrics[selectedMetricIndex]?.name || 'Health Metric' : 'Health Metric'}
                    </Dialog.Title>
                    <Dialog.ScrollArea style={{ maxHeight: 630, paddingHorizontal: 0 }}>
                        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}>
                            {selectedMetricIndex !== null && reviewMetrics[selectedMetricIndex] && (() => {
                                const metric = reviewMetrics[selectedMetricIndex];
                                const rangeStatus = calculateRangeStatus(parseFloat(metric.value), metric.normalRangeLower, metric.normalRangeUpper);

                                return (
                                    <View>
                                        {/* Value and Status */}
                                        <View style={{ marginBottom: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Value</Text>
                                                {rangeStatus && (
                                                    <Chip style={{ backgroundColor: rangeStatus === 'normal' ? '#4CAF5020' : '#FF980020', marginLeft: 12 }}>
                                                        <Text style={{ color: rangeStatus === 'normal' ? '#4CAF50' : '#FF9800', fontWeight: 'bold' }}>
                                                            {rangeStatus === 'normal' ? 'Normal' : (rangeStatus === 'high' ? 'High' : 'Low')}
                                                        </Text>
                                                    </Chip>
                                                )}
                                            </View>
                                            <Text variant="headlineMedium" style={{ fontWeight: 'bold' }}>
                                                {metric.value} {metric.unit}
                                            </Text>
                                        </View>

                                        {/* Normal Range */}
                                        {(metric.normalRangeLower || metric.normalRangeUpper) && (
                                            <>
                                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Normal Range</Text>
                                                <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                                                    {metric.normalRangeLower || '?'} - {metric.normalRangeUpper || '?'} {metric.unit}
                                                </Text>
                                            </>
                                        )}

                                        {/* Precautions */}
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Precautions</Text>
                                        {(() => {
                                            const text = metric.measurementPrecautions || 'Not available';
                                            const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                            if (sentences.length <= 1) {
                                                return <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{text}</Text>;
                                            }
                                            return (
                                                <View style={{ marginBottom: 16 }}>
                                                    {sentences.map((s: string, i: number) => (
                                                        <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                    ))}
                                                </View>
                                            );
                                        })()}

                                        {/* Monitoring Guidance */}
                                        <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>Monitoring Guidance</Text>
                                        {(() => {
                                            const text = metric.monitoringGuidance || 'Not available';
                                            const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
                                            if (sentences.length <= 1) {
                                                return <Text variant="bodyMedium">{text}</Text>;
                                            }
                                            return (
                                                <View>
                                                    {sentences.map((s: string, i: number) => (
                                                        <Text key={i} variant="bodyMedium" style={{ marginBottom: 2 }}>• {s.trim()}</Text>
                                                    ))}
                                                </View>
                                            );
                                        })()}
                                    </View>
                                );
                            })()}
                        </ScrollView>
                    </Dialog.ScrollArea>
                </Dialog>
            </Portal >
        </SafeAreaView >
    );
}





const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing.sm, paddingTop: tokens.spacing.sm },
    scrollView: { flex: 1 },
    scrollContent: { padding: tokens.spacing.lg, paddingBottom: 100 },
    instruction: { textAlign: 'center', marginBottom: tokens.spacing.xl },
    uploadOptions: { flexDirection: 'row', gap: tokens.spacing.md },
    uploadCard: { flex: 1, borderRadius: tokens.radius.lg },
    uploadCardContent: { alignItems: 'center', paddingVertical: tokens.spacing.xl, gap: tokens.spacing.sm },
    uploadIcon: { width: 64, height: 64, borderRadius: tokens.radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing.sm },
    uploadingContainer: { alignItems: 'center', paddingVertical: tokens.spacing.xxl },
    progressBar: { width: '100%', height: 8, borderRadius: 4, marginTop: tokens.spacing.md },
    reviewCard: { marginBottom: tokens.spacing.sm },
    input: { marginBottom: tokens.spacing.md },
    confirmButton: { marginTop: tokens.spacing.md, padding: 4 },
    successContainer: { alignItems: 'center', paddingVertical: tokens.spacing.lg },
    successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
    doneButton: { width: '100%', borderRadius: tokens.radius.xl },

    // Summary Steps
    summaryContainer: { alignItems: 'center', paddingVertical: tokens.spacing.lg },
    summaryStats: { width: '100%', marginVertical: tokens.spacing.lg, gap: 12 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f5f5f5', borderRadius: 12 },
    badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },

    // Insights
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 },
    insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
});
