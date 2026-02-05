import { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, ActivityIndicator, ProgressBar, RadioButton, TextInput, HelperText, Portal, Dialog, Modal, Divider, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { getCurrentUser, transcribeAudio, generateSpeech } from '../../src/services/api';
import CameraWithOverlay from '../../src/components/CameraWithOverlay';

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
    const [editingItem, setEditingItem] = useState<{ type: 'medication' | 'metric' | 'body_condition' | 'bodily_excretion' | 'todo', index: number } | null>(null);

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
    const [isSpeaking, setIsSpeaking] = useState(false); // TTS state

    // Body Conditions Review State
    const [reviewBodyConditions, setReviewBodyConditions] = useState<any[]>([]);
    const [reviewBodilyExcretions, setReviewBodilyExcretions] = useState<any[]>([]);
    const [reviewTodos, setReviewTodos] = useState<any[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const currentSoundRef = useRef<any>(null);

    // Auto-trigger upload when step changes to 'uploading'
    useEffect(() => {
        if (step === 'uploading' && image && !isUploading) {
            handleUpload();
        }
    }, [step, image]);

    const pickImage = useCallback(async (source: 'camera' | 'library') => {
        try {
            let result;

            if (source === 'camera') {
                setStep('camera');
                return;
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
    const speakMetricDetails = async (metric: any) => {
        if (isSpeaking) {
            await stopSpeaking();
            return;
        }

        try {
            await stopSpeaking();
            setIsSpeaking(true);

            // Calculate status string
            const rangeStatus = calculateRangeStatus(parseFloat(metric.value), metric.normalRangeLower, metric.normalRangeUpper);
            let statusText = '';
            if (rangeStatus === 'normal') statusText = 'is within normal range';
            if (rangeStatus === 'high') statusText = 'is higher than normal';
            if (rangeStatus === 'low') statusText = 'is lower than normal';

            const textToSpeak = [
                `Name: ${metric.name}`,
                `Measured value: ${metric.value} ${metric.unit}`,
                metric.measurementPrecautions ? `Measurement Precautions: ${metric.measurementPrecautions}` : '',
                metric.monitoringGuidance ? `Monitoring Guidance: ${metric.monitoringGuidance}` : '',
                (metric.normalRangeLower || metric.normalRangeUpper) ? `Normal Range: ${metric.normalRangeLower || '?'} to ${metric.normalRangeUpper || '?'}` : '',
                statusText ? `Range Status: ${statusText}` : ''
            ].filter(Boolean).join('. ');

            const { audioContent } = await generateSpeech(textToSpeak);
            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/mp3;base64,${audioContent}` },
                { shouldPlay: true }
            );

            currentSoundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    currentSoundRef.current = null;
                    setIsSpeaking(false);
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            console.error('TTS Error:', error);
            setIsSpeaking(false);
            alert('Failed to play audio');
        }
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
        setReviewMetrics([...reviewMetrics, { name: '', value: '', unit: '', recordedAt: new Date().toISOString() }]);
    };

    const handleRemoveMetric = (index: number) => {
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
        setReviewTodos([...reviewTodos, {
            title: '',
            description: '',
            priority: 'medium',
            dueDate: null
        }]);
    };

    const handleRemoveTodo = (index: number) => {
        const updated = [...reviewTodos];
        updated.splice(index, 1);
        setReviewTodos(updated);
    };

    const handleConfirmReview = async () => {
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
                    location_description: c.locationDescription || c.location_description,
                    width_mm: c.dimensions?.widthMm || c.width_mm,
                    height_mm: c.dimensions?.heightMm || c.height_mm,
                    area_mm2: c.dimensions?.areaMm2 || c.area_mm2,
                    depth_mm: c.dimensions?.depthMm || c.depth_mm,
                    color: c.color,
                    texture: c.texture,
                    shape: c.shape,
                    severity: c.severity,
                    condition_type: c.conditionType || c.condition_type,
                    notes: c.notes,
                    observed_at: c.observedAt || c.observed_at || new Date().toISOString(),
                    summary: c.summary || null, // Save summary
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

            // Todos Insertion (as Calendar Events)
            if (reviewTodos.length > 0) {
                const todosToInsert = reviewTodos.map(t => ({
                    user_id: userId,
                    document_id: documentId,
                    title: t.title || 'New Task',
                    description: t.description || t.summary,
                    type: 'todo',
                    scheduled_at: t.dueDate ? new Date(t.dueDate).toISOString() : new Date().toISOString(),
                    duration_minutes: 30,
                    completed: false
                }));
                const { error: todoError } = await supabase.from('calendar_events').insert(todosToInsert as any);
                if (todoError) throw todoError;
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

    const stopSpeaking = async () => {
        if (currentSoundRef.current) {
            try {
                await currentSoundRef.current.stopAsync();
                await currentSoundRef.current.unloadAsync();
            } catch (e) {
                console.log('Error stopping sound:', e);
            }
            currentSoundRef.current = null;
        }
        setIsSpeaking(false);
    };

    const speakText = async (text: string) => {
        if (!text) return;

        // If already speaking, stop
        if (isSpeaking) {
            await stopSpeaking();
            return;
        }

        try {
            await stopSpeaking(); // Stop any existing audio
            setIsSpeaking(true);

            const { audioContent } = await generateSpeech(text);
            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/mp3;base64,${audioContent}` },
                { shouldPlay: true }
            );

            currentSoundRef.current = sound;

            // Clear state when playback finishes
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    currentSoundRef.current = null;
                    setIsSpeaking(false);
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            console.error('TTS Error:', error);
            setIsSpeaking(false);
            alert('Failed to play audio');
        }
    };

    if (step === 'camera') {
        return (
            <View style={{ flex: 1, backgroundColor: 'black' }}>
                <CameraWithOverlay
                    onCapture={(uri) => {
                        setImage(uri);
                        setStep('describe');
                    }}
                    onClose={() => setStep('select')}
                />
            </View>
        );
    }

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

                {step === 'review' && (
                    <View style={{ paddingBottom: 100 }}>




                        {/* Medications Summary Cards */}
                        {reviewMeds.map((med, index) => (
                            <Card
                                key={`med-${index}`}
                                style={styles.reviewCard}
                                onPress={() => setEditingItem({ type: 'medication', index })}
                            >
                                <Card.Title
                                    title={med.name || 'Unknown Medication'}
                                    subtitle={med.instructions || 'No instructions available'}
                                    subtitleNumberOfLines={0}
                                    left={(props) => <MaterialCommunityIcons {...props} name="pill" />}
                                    right={(props) => (
                                        <IconButton
                                            {...props}
                                            icon={isSpeaking ? 'stop' : 'volume-high'}
                                            iconColor={isSpeaking ? theme.colors.error : undefined}
                                            onPress={() => {
                                                const textToSpeak = [
                                                    med.name,
                                                    med.indication ? `Indication: ${med.indication}` : '',
                                                    med.instructions ? `Instructions: ${med.instructions}` : '',
                                                    med.precaution ? `Precaution: ${med.precaution}` : '',
                                                    med.monitoringRecommendation ? `Monitoring: ${med.monitoringRecommendation}` : ''
                                                ].filter(Boolean).join('. ');
                                                speakText(textToSpeak);
                                            }}
                                        />
                                    )}
                                />
                            </Card>
                        ))}

                        {/* Metrics Summary Cards */}
                        {reviewMetrics.map((metric, index) => {
                            const rangeStatus = calculateRangeStatus(parseFloat(metric.value), metric.normalRangeLower, metric.normalRangeUpper);
                            const statusColor = rangeStatus === 'normal' ? 'green' : (rangeStatus === 'high' || rangeStatus === 'low' ? 'orange' : theme.colors.primary);

                            return (
                                <Card
                                    key={`metric-${index}`}
                                    style={styles.reviewCard}
                                    onPress={() => setSelectedMetricIndex(index)}
                                >
                                    <Card.Title
                                        title={metric.name || 'New Metric'}
                                        subtitle={`${metric.value} ${metric.unit}`}
                                        left={(props) => <MaterialCommunityIcons {...props} name="heart-pulse" />}
                                        right={(props) => (
                                            <IconButton
                                                {...props}
                                                icon="volume-high"
                                                onPress={() => speakMetricDetails(metric)}
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
                                onPress={() => setEditingItem({ type: 'body_condition', index })}
                            >
                                <Card.Title
                                    title={condition.conditionType || 'Body Condition'}
                                    subtitle={condition.bodyLocation}
                                    left={(props) => <MaterialCommunityIcons {...props} name="account-injury" />}
                                    right={(props) => <IconButton {...props} icon="pencil" />}
                                />
                            </Card>
                        ))}

                        {/* Excretions Summary Cards */}
                        {reviewBodilyExcretions.map((excretion, index) => (
                            <Card
                                key={`excr-${index}`}
                                style={styles.reviewCard}
                                onPress={() => setEditingItem({ type: 'bodily_excretion', index })}
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
                                onPress={() => setEditingItem({ type: 'todo', index })}
                            >
                                <Card.Title
                                    title={todo.title || 'Task'}
                                    subtitle={todo.dueDate ? `Due: ${new Date(todo.dueDate).toLocaleDateString()}` : 'No Due Date'}
                                    left={(props) => <MaterialCommunityIcons {...props} name="checkbox-marked-circle-outline" />}
                                    right={(props) => <IconButton {...props} icon="pencil" />}
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
                )}

                {step === 'success' && (
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
                )}
            </ScrollView>

            {/* Edit Modals */}
            <Portal>
                {/* Medication Modal */}
                <Dialog visible={editingItem?.type === 'medication'} onDismiss={() => setEditingItem(null)} style={{ width: '90%', alignSelf: 'center', borderRadius: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', position: 'absolute', right: 0, top: 0, zIndex: 1 }}>
                        <IconButton icon="close" size={20} onPress={() => setEditingItem(null)} />
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
                <Dialog visible={editingItem?.type === 'metric'} onDismiss={() => setEditingItem(null)}>
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
                                setEditingItem(null);
                            }
                        }} textColor={theme.colors.error}>Remove</Button>
                        <Button onPress={() => setEditingItem(null)}>Done</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Condition Modal */}
                <Dialog visible={editingItem?.type === 'body_condition'} onDismiss={() => setEditingItem(null)}>
                    <Dialog.Title>Edit Condition</Dialog.Title>
                    <Dialog.Content>
                        {editingItem?.type === 'body_condition' && (
                            <ScrollView>
                                <TextInput
                                    label="Type"
                                    value={reviewBodyConditions[editingItem.index]?.conditionType}
                                    onChangeText={(t) => handleUpdateBodyCondition(editingItem.index, 'conditionType', t)}
                                    style={styles.input} mode="outlined"
                                />
                                <TextInput
                                    label="Location"
                                    value={reviewBodyConditions[editingItem.index]?.bodyLocation}
                                    onChangeText={(t) => handleUpdateBodyCondition(editingItem.index, 'bodyLocation', t)}
                                    style={styles.input} mode="outlined"
                                />
                                <TextInput
                                    label="Notes"
                                    value={reviewBodyConditions[editingItem.index]?.notes}
                                    onChangeText={(t) => handleUpdateBodyCondition(editingItem.index, 'notes', t)}
                                    style={styles.input} mode="outlined" multiline
                                />
                            </ScrollView>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setEditingItem(null)}>Done</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Todo Modal */}
                <Dialog visible={editingItem?.type === 'todo'} onDismiss={() => setEditingItem(null)}>
                    <Dialog.Title>Edit Task</Dialog.Title>
                    <Dialog.Content>
                        {editingItem?.type === 'todo' && (
                            <>
                                <TextInput
                                    label="Title"
                                    value={reviewTodos[editingItem.index]?.title}
                                    onChangeText={(t) => handleUpdateTodo(editingItem.index, 'title', t)}
                                    style={styles.input} mode="outlined"
                                />
                                <TextInput
                                    label="Description"
                                    value={reviewTodos[editingItem.index]?.description}
                                    onChangeText={(t) => handleUpdateTodo(editingItem.index, 'description', t)}
                                    style={styles.input} mode="outlined" multiline
                                />
                            </>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => {
                            if (editingItem && editingItem.type === 'todo') {
                                handleRemoveTodo(editingItem.index);
                                setEditingItem(null);
                            }
                        }} textColor={theme.colors.error}>Remove</Button>
                        <Button onPress={() => setEditingItem(null)}>Done</Button>
                    </Dialog.Actions>
                </Dialog>
                {/* Metric Details Modal */}
                <Modal
                    visible={selectedMetricIndex !== null}
                    onDismiss={() => setSelectedMetricIndex(null)}
                    contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8 }}
                >
                    <ScrollView>
                        {selectedMetricIndex !== null && reviewMetrics[selectedMetricIndex] && (() => {
                            const metric = reviewMetrics[selectedMetricIndex];
                            const rangeStatus = calculateRangeStatus(parseFloat(metric.value), metric.normalRangeLower, metric.normalRangeUpper);
                            const statusColor = rangeStatus === 'normal' ? 'green' : (rangeStatus === 'high' || rangeStatus === 'low' ? 'orange' : theme.colors.primary);

                            return (
                                <View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <Text variant="headlineSmall" style={{ flex: 1 }}>{metric.name}</Text>
                                        <IconButton
                                            icon={isSpeaking ? 'stop' : 'volume-high'}
                                            mode="contained"
                                            onPress={() => speakMetricDetails(metric)}
                                        />
                                    </View>

                                    <Divider style={{ marginVertical: 10 }} />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                        <View>
                                            <Text variant="labelMedium" style={{ color: theme.colors.outline }}>Value</Text>
                                            <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                                                {metric.value} <Text variant="titleMedium">{metric.unit}</Text>
                                            </Text>
                                        </View>

                                        {rangeStatus && (
                                            <View>
                                                <Text variant="labelMedium" style={{ color: theme.colors.outline, marginBottom: 4 }}>Range Status</Text>
                                                <Chip style={{ backgroundColor: statusColor + '20' }}>
                                                    <Text style={{ color: statusColor, fontWeight: 'bold' }}>
                                                        {rangeStatus === 'normal' ? 'Within Normal Range' : (rangeStatus === 'high' ? 'Too High' : 'Too Low')}
                                                    </Text>
                                                </Chip>
                                            </View>
                                        )}
                                    </View>

                                    {(metric.normalRangeLower || metric.normalRangeUpper) && (
                                        <View style={{ marginBottom: 15 }}>
                                            <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 5 }}>Normal Range</Text>
                                            <Text variant="bodyLarge">
                                                {metric.normalRangeLower || '?'} - {metric.normalRangeUpper || '?'} {metric.unit}
                                            </Text>
                                        </View>
                                    )}

                                    {metric.measurementPrecautions && (
                                        <View style={{ marginBottom: 15, backgroundColor: theme.colors.secondaryContainer, padding: 15, borderRadius: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.onSecondaryContainer} />
                                                <Text variant="titleMedium" style={{ fontWeight: 'bold', marginLeft: 8, color: theme.colors.onSecondaryContainer }}>Precautions</Text>
                                            </View>
                                            <Text variant="bodyMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                                                {formatSentences(metric.measurementPrecautions)}
                                            </Text>
                                        </View>
                                    )}

                                    {metric.monitoringGuidance && (
                                        <View style={{ marginBottom: 15, backgroundColor: theme.colors.tertiaryContainer, padding: 15, borderRadius: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                                <MaterialCommunityIcons name="clipboard-pulse-outline" size={20} color={theme.colors.onTertiaryContainer} />
                                                <Text variant="titleMedium" style={{ fontWeight: 'bold', marginLeft: 8, color: theme.colors.onTertiaryContainer }}>Monitoring Guidance</Text>
                                            </View>
                                            <Text variant="bodyMedium" style={{ color: theme.colors.onTertiaryContainer }}>
                                                {formatSentences(metric.monitoringGuidance)}
                                            </Text>
                                        </View>
                                    )}

                                    <Button mode="contained" onPress={() => setSelectedMetricIndex(null)} style={{ marginTop: 10 }}>
                                        Close
                                    </Button>
                                </View>
                            );
                        })()}
                    </ScrollView>
                </Modal>
            </Portal>
        </SafeAreaView>
    );
}



const formatSentences = (text: string) => {
    if (!text) return null;
    // Split by period followed by space, or newline
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    if (sentences.length <= 1) return <Text>{text}</Text>;

    return (
        <View>
            {sentences.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' }}>
                    <Text style={{ marginRight: 6 }}>{'\u2022'}</Text>
                    <Text style={{ flex: 1 }}>{s.trim()}</Text>
                </View>
            ))}
        </View>
    );
};

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
