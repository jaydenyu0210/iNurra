import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, ActivityIndicator, ProgressBar, RadioButton, TextInput, HelperText, Portal, Dialog } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { getCurrentUser } from '../../src/services/api';

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
    const [step, setStep] = useState<'select' | 'type' | 'uploading' | 'review' | 'success'>('select');

    // Medication Review State
    const [reviewMeds, setReviewMeds] = useState<any[]>([]);

    // Metrics Review State
    const [reviewMetrics, setReviewMetrics] = useState<any[]>([]);

    const [isSaving, setIsSaving] = useState(false);

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
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) {
                    alert('Camera permission is required to take photos');
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
                setStep('uploading');
            }
        } catch (error) {
            console.error('Error picking image:', error);
            alert('Failed to pick image');
        }
    }, []);

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
            const result = await processDocument(documentId, storagePath);

            setUploadProgress(1);
            setProcessingResult(result);
            setIsUploading(false);

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

            console.log('=== MEDICATION EXTRACTION DEBUG ===');
            console.log('Document type:', docType);
            console.log('result.extractedData:', JSON.stringify(result.extractedData, null, 2));
            console.log('extractedMeds.length:', extractedMeds.length);
            console.log('extractedMetrics.length:', extractedMetrics.length);

            if (extractedMeds.length > 0 || docType === 'prescription') {
                let medsToReview = [];

                if (extractedMeds.length > 0) {
                    // Populate from extracted data
                    console.log('Mapping extracted medications to review form...');
                    medsToReview = extractedMeds.map((m: any, i: number) => {
                        console.log(`Med ${i}:`, JSON.stringify(m, null, 2));
                        return {
                            ...m,
                            quantity: m.quantity ? String(m.quantity) : '',
                            frequency: m.frequencyHours ? String(m.frequencyHours) : '',
                            duration: m.durationDays ? String(m.durationDays) : '',
                            schedule: m.schedule || null,
                            endDate: m.endDate || null
                        };
                    });
                    console.log('medsToReview:', JSON.stringify(medsToReview, null, 2));
                } else {
                    // Fallback: Add one empty medication slot for manual entry
                    console.log('No meds extracted but identified as prescription. Adding manual entry.');
                    medsToReview = [{
                        name: '',
                        dosage: '',
                        frequency: '', // Represents hours between doses
                        duration: '', // Days to take medication
                        instructions: '',
                        quantity: '',
                        schedule: null,
                        endDate: null
                    }];
                }

                setReviewMeds(medsToReview);
                setStep('review');
            } else if (extractedMetrics.length > 0 || docType.includes('health') || docType.includes('test')) {
                let metricsToReview = [];
                if (extractedMetrics.length > 0) {
                    metricsToReview = extractedMetrics.map((m: any) => ({
                        ...m,
                        value: m.value ? String(m.value) : '',
                        recordedAt: m.recordedAt || new Date().toISOString()
                    }));
                } else {
                    metricsToReview = [{ name: '', value: '', unit: '', recordedAt: new Date().toISOString() }];
                }
                setReviewMetrics(metricsToReview);
                setStep('review');
            } else {
                setStep('success');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload document. Please try again.');
            setIsUploading(false);
            setStep('select');
        }
    };

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

    const handleConfirmReview = async () => {
        setIsSaving(true);
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
                }));
                const { error: metricError } = await supabase.from('health_metrics').insert(metricsToInsert as any);
                if (metricError) throw metricError;
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
            console.error('Error saving medications:', error);
            alert('Failed to save medications: ' + (error as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDone = () => {
        let target = '/documents/list'; // Default to documents list
        if (reviewMetrics.length > 0) {
            target = '/(tabs)/health';
        } else if (reviewMeds.length > 0) {
            target = '/(tabs)/medications';
        }

        // Dismiss all screens in upload flow, then replace with target
        // This clears the stack and puts target on top of home without showing home
        router.dismissAll();
        router.replace(target as any);
    };

    const handleUploadAnother = () => {
        setImage(null);
        setSelectedType(null);
        setUploadProgress(0);
        setStep('select');
        setReviewMeds([]);
        setUploadedDocId(null); // Reset ID
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

                {step === 'uploading' && (
                    <View style={styles.uploadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text variant="titleMedium" style={{ marginTop: tokens.spacing.lg }}>Processing...</Text>
                        <ProgressBar progress={uploadProgress} color={theme.colors.primary} style={styles.progressBar} />
                    </View>
                )}

                {step === 'review' && reviewMeds.length > 0 && (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <Text variant="bodyMedium" style={{ marginBottom: 16, textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                            Review and edit detected medications.
                        </Text>

                        {/* List View of Editable Cards */}
                        {reviewMeds.map((med, index) => (
                            <Card key={index} style={styles.reviewCard}>

                                <Card.Content>
                                    <TextInput
                                        label="Medication Name"
                                        value={med.name}
                                        onChangeText={(text) => handleUpdateMed(index, 'name', text)}
                                        style={styles.input}
                                        mode="outlined"
                                    />
                                    <TextInput
                                        label="Quantity (total pills)"
                                        value={med.quantity}
                                        onChangeText={(text) => handleUpdateMed(index, 'quantity', text)}
                                        style={styles.input}
                                        mode="outlined"
                                        keyboardType="numeric"
                                    />
                                    <TextInput
                                        label="Frequency (Hours between doses)"
                                        value={med.frequency}
                                        onChangeText={(text) => handleUpdateMed(index, 'frequency', text)}
                                        style={styles.input}
                                        mode="outlined"
                                        keyboardType="numeric"
                                    // placeholder="e.g. 8"
                                    />
                                    <TextInput
                                        label="Dosage"
                                        value={med.dosage}
                                        onChangeText={(text) => handleUpdateMed(index, 'dosage', text)}
                                        style={styles.input}
                                        mode="outlined"
                                    />
                                    <TextInput
                                        label="Duration (days)"
                                        value={med.duration}
                                        onChangeText={(text) => handleUpdateMed(index, 'duration', text)}
                                        style={styles.input}
                                        mode="outlined"
                                        keyboardType="numeric"
                                    />
                                </Card.Content>
                            </Card>
                        ))}



                        <Button
                            mode="contained"
                            onPress={handleConfirmReview}
                            style={styles.confirmButton}
                            loading={isSaving}
                            disabled={isSaving}
                        >
                            Confirm All & Save
                        </Button>
                    </KeyboardAvoidingView>
                )}

                {step === 'review' && reviewMetrics.length > 0 && (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <Text variant="bodyMedium" style={{ marginBottom: 16, textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
                            Review and edit detected health metrics.
                        </Text>

                        {reviewMetrics.map((metric, index) => (
                            <Card key={index} style={styles.reviewCard}>
                                <Card.Title
                                    title={`Metric ${index + 1}: ${metric.name || 'New'}`}
                                />
                                <Card.Content>
                                    <TextInput
                                        label="Name"
                                        value={metric.name}
                                        onChangeText={(text) => handleUpdateMetric(index, 'name', text)}
                                        style={styles.input}
                                        mode="outlined"
                                    />
                                    <TextInput
                                        label="Value"
                                        value={metric.value}
                                        onChangeText={(text) => handleUpdateMetric(index, 'value', text)}
                                        style={styles.input}
                                        mode="outlined"
                                        keyboardType="numeric"
                                    />
                                    <TextInput
                                        label="Unit"
                                        value={metric.unit}
                                        onChangeText={(text) => handleUpdateMetric(index, 'unit', text)}
                                        style={styles.input}
                                        mode="outlined"
                                    />
                                    {/* Date input removed as per user request */}
                                </Card.Content>
                            </Card>
                        ))}

                        {/* 'Add Another Metric' button removed as per request for single-upload flow */}

                        <Button
                            mode="contained"
                            onPress={handleConfirmReview}
                            style={styles.confirmButton}
                            loading={isSaving}
                            disabled={isSaving}
                        >
                            Confirm & Save Metrics
                        </Button>
                    </KeyboardAvoidingView>
                )}

                {step === 'success' && (
                    <View style={styles.successContainer}>
                        <View style={[styles.successIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                            <MaterialCommunityIcons name="check" size={48} color={theme.colors.secondary} />
                        </View>
                        <Text variant="headlineSmall" style={{ marginTop: tokens.spacing.lg }}>Success!</Text>
                        <Text variant="bodyMedium" style={{ textAlign: 'center', marginVertical: tokens.spacing.md }}>
                            {reviewMetrics.length > 0
                                ? 'Health Metrics saved!'
                                : reviewMeds.length > 0
                                    ? 'Medications saved!'
                                    : 'Document saved!'}
                        </Text>
                        <Button mode="contained" onPress={handleDone} style={styles.doneButton}>
                            {reviewMetrics.length > 0
                                ? 'Go to Health Metrics'
                                : reviewMeds.length > 0
                                    ? 'Go to Medications'
                                    : 'Go to Documents'}
                        </Button>
                        <Button mode="outlined" onPress={handleUploadAnother} style={{ marginTop: 12 }}>
                            Upload Another
                        </Button>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
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
    reviewCard: { marginBottom: tokens.spacing.lg },
    input: { marginBottom: tokens.spacing.md },
    confirmButton: { marginTop: tokens.spacing.md, padding: 4 },
    successContainer: { alignItems: 'center', paddingVertical: tokens.spacing.lg },
    successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
    doneButton: { width: '100%', borderRadius: tokens.radius.xl },
});
