import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { CameraView, useCameraPermissions, CameraType, FlashMode } from 'expo-camera';
import { Text, IconButton, ActivityIndicator, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { detectBodyCondition } from '../services/api';

interface CameraWithOverlayProps {
    onCapture: (uri: string) => void;
    onClose: () => void;
}

export default function CameraWithOverlay({ onCapture, onClose }: CameraWithOverlayProps) {
    const theme = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<FlashMode>('off');
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [shouldBurnOverlay, setShouldBurnOverlay] = useState(false);

    // Zoom State
    const [zoom, setZoom] = useState(0);
    const [startZoom, setStartZoom] = useState(0);

    // Default to showing overlay in viewfinder so user can align if needed
    const showOverlayInViewfinder = true;

    const cameraRef = useRef<CameraView>(null);
    const viewShotRef = useRef<View>(null);

    // Zoom Gesture
    const pinchGesture = Gesture.Pinch()
        .onStart(() => {
            setStartZoom(zoom);
        })
        .onUpdate((e) => {
            const velocity = e.velocity / 20;
            let newZoom = startZoom + (e.scale - 1);
            // Clamp 0-1
            if (newZoom < 0) newZoom = 0;
            if (newZoom > 1) newZoom = 1;
            setZoom(newZoom);
        });

    // Effect to trigger capture only when image is actually loaded in the invisible view
    useEffect(() => {
        if (capturedImage && shouldBurnOverlay && isImageLoaded) {
            captureComposite();
        } else if (capturedImage && !shouldBurnOverlay) {
            onCapture(capturedImage);
        }
    }, [capturedImage, shouldBurnOverlay, isImageLoaded]);

    const captureComposite = async () => {
        try {
            if (viewShotRef.current) {
                console.log("Capturing composite image via ViewShot...");
                const uri = await captureRef(viewShotRef, {
                    format: 'jpg',
                    quality: 0.9,
                    result: 'tmpfile'
                });
                console.log("Composite output saved:", uri);
                onCapture(uri);
            }
        } catch (e) {
            console.error("ViewShot failed", e);
            if (capturedImage) onCapture(capturedImage);
        }
    };

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.button}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    const toggleFlash = () => {
        setFlash(current => (current === 'off' ? 'on' : 'off'));
    };

    const takePicture = async () => {
        if (isCapturing || !cameraRef.current) return;

        try {
            setIsCapturing(true);

            // 1. Take High-Res Photo (File only)
            console.log('Taking high-res photo...');
            const highResPhoto = await cameraRef.current.takePictureAsync({
                quality: 1.0,
                base64: false,
                skipProcessing: false,
            });

            if (!highResPhoto?.uri) {
                throw new Error("Failed to capture photo");
            }

            // 2. Take Low-Res Snapshot for Analysis (Base64)
            console.log('Taking analysis snapshot...');
            const analysisSnapshot = await cameraRef.current.takePictureAsync({
                quality: 0.1,
                base64: true,
                skipProcessing: true,
                scale: 0.2,
                shutterSound: false,
            });

            // 3. Analyze
            let isBodyCondition = false;
            if (analysisSnapshot?.base64) {
                console.log('Analyzing image...');
                isBodyCondition = await detectBodyCondition(analysisSnapshot.base64);
                console.log('Is Body Condition:', isBodyCondition);
            }

            // 4. Decide Path
            if (isBodyCondition) {
                setShouldBurnOverlay(true);
                setCapturedImage(highResPhoto.uri);
            } else {
                onCapture(highResPhoto.uri);
            }

        } catch (error) {
            console.error('Failed to take/process picture:', error);
            setIsCapturing(false);
        }
    };

    // Calculate dynamic scale for grid based on zoom
    // 1x zoom -> scale 1
    // Max digital zoom is usually ~4-5x. 
    // We'll approximate visual scaling: scale = 1 + zoom * 3
    const gridScale = 1 + (zoom * 3);

    // COMPOSITION VIEW: Active when image captured + overlay enabled for burning
    if (capturedImage && shouldBurnOverlay) {
        return (
            <View style={styles.container}>
                <ViewShot ref={viewShotRef} style={{ flex: 1 }} options={{ format: 'jpg', quality: 0.9 }}>
                    <Image
                        source={{ uri: capturedImage }}
                        style={styles.previewImage}
                        resizeMode="contain"
                        onLoad={() => setIsImageLoaded(true)}
                    />

                    {/* Overlay - Burned In with same scale */}
                    <View style={[styles.overlayContainer, StyleSheet.absoluteFill]}>
                        <View style={[styles.rulerContainer, { transform: [{ scale: gridScale }] }]}>
                            <View style={styles.rulerRow}>
                                {[...Array(11)].map((_, i) => (
                                    <View key={`top-${i}`} style={[styles.tickMark, { height: i % 5 === 0 ? 20 : 10 }]} />
                                ))}
                            </View>
                            <View style={styles.rulerMiddleRow}>
                                <View style={styles.rulerCol}>
                                    {[...Array(16)].map((_, i) => (
                                        <View key={`left-${i}`} style={[styles.tickMarkHorz, { width: i % 5 === 0 ? 20 : 10 }]} />
                                    ))}
                                </View>
                                <View style={styles.emptyTargetArea} />
                                <View style={styles.rulerColRight}>
                                    {[...Array(16)].map((_, i) => (
                                        <View key={`right-${i}`} style={[styles.tickMarkHorz, { width: i % 5 === 0 ? 20 : 10 }]} />
                                    ))}
                                </View>
                            </View>
                            <View style={styles.rulerRowBottom}>
                                {[...Array(11)].map((_, i) => (
                                    <View key={`bottom-${i}`} style={[styles.tickMark, { height: i % 5 === 0 ? 20 : 10 }]} />
                                ))}
                            </View>
                        </View>
                    </View>
                </ViewShot>

                <View style={[styles.overlayContainer, StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }]}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={{ color: 'white', marginTop: 10 }}>Saving...</Text>
                </View>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={pinchGesture}>
                <View style={styles.container}>
                    <CameraView
                        ref={cameraRef}
                        style={[styles.camera, StyleSheet.absoluteFill]}
                        facing={facing}
                        flash={flash}
                        mode="picture"
                        zoom={zoom}
                    />

                    <SafeAreaView style={[styles.uiContainer, StyleSheet.absoluteFill]} pointerEvents="box-none">
                        {/* Header Controls */}
                        <View style={styles.header} pointerEvents="box-none">
                            <IconButton
                                icon="close"
                                iconColor="white"
                                size={28}
                                onPress={onClose}
                                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                            />
                            <View style={styles.headerRight}>
                                <IconButton
                                    icon={flash === 'on' ? 'flash' : 'flash-off'}
                                    iconColor="white"
                                    size={28}
                                    onPress={toggleFlash}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                                />
                            </View>
                        </View>

                        {/* Ruler Overlay - Dynamic Scale */}
                        {showOverlayInViewfinder && (
                            <View style={styles.overlayContainer} pointerEvents="none">
                                <View style={[styles.rulerContainer, { transform: [{ scale: gridScale }] }]}>
                                    <View style={styles.rulerRow}>
                                        {[...Array(11)].map((_, i) => (
                                            <View key={`top-${i}`} style={[styles.tickMark, { height: i % 5 === 0 ? 20 : 10 }]} />
                                        ))}
                                    </View>
                                    <View style={styles.rulerMiddleRow}>
                                        <View style={styles.rulerCol}>
                                            {[...Array(16)].map((_, i) => (
                                                <View key={`left-${i}`} style={[styles.tickMarkHorz, { width: i % 5 === 0 ? 20 : 10 }]} />
                                            ))}
                                        </View>
                                        <View style={styles.emptyTargetArea} />
                                        <View style={styles.rulerColRight}>
                                            {[...Array(16)].map((_, i) => (
                                                <View key={`right-${i}`} style={[styles.tickMarkHorz, { width: i % 5 === 0 ? 20 : 10 }]} />
                                            ))}
                                        </View>
                                    </View>
                                    <View style={styles.rulerRowBottom}>
                                        {[...Array(11)].map((_, i) => (
                                            <View key={`bottom-${i}`} style={[styles.tickMark, { height: i % 5 === 0 ? 20 : 10 }]} />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Zoom Indicator */}
                        <View style={{ position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 }} pointerEvents="none">
                            <Text style={{ color: 'white', fontSize: 12 }}>{`Zoom: ${(1 + zoom * 3).toFixed(1)}x`}</Text>
                        </View>

                        {/* Bottom Controls */}
                        <View style={styles.controls} pointerEvents="box-none">
                            <IconButton
                                icon="camera-flip"
                                iconColor="white"
                                size={32}
                                onPress={toggleCameraFacing}
                                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                            />

                            <TouchableOpacity
                                onPress={takePicture}
                                style={styles.captureBtnOuter}
                                disabled={isCapturing}
                            >
                                <View style={styles.captureBtnInner}>
                                    {isCapturing && <ActivityIndicator color={theme.colors.primary} size="small" />}
                                </View>
                            </TouchableOpacity>

                            <View style={{ width: 56 }} />
                        </View>
                    </SafeAreaView>
                </View>
            </GestureDetector>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
        color: 'white',
    },
    camera: {
        flex: 1,
    },
    previewImage: {
        flex: 1,
        backgroundColor: 'black',
    },
    uiContainer: {
        flex: 1,
        justifyContent: 'space-between',
        zIndex: 1,
        overflow: 'hidden', // Clip overlay if it scales too big
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    headerRight: {
        flexDirection: 'row',
    },
    detectingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    detectingText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingBottom: 40,
    },
    button: {
        alignItems: 'center',
        backgroundColor: '#DDDDDD',
        padding: 10,
        borderRadius: 5,
        margin: 20,
    },
    closeButton: {
        alignItems: 'center',
        padding: 10,
        borderRadius: 5,
        margin: 20,
        marginTop: 0,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'black',
    },
    captureBtnOuter: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureBtnInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Overlay Styles
    overlayContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    rulerContainer: {
        width: '90%',
        aspectRatio: 3 / 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        borderRadius: 4,
        position: 'relative',
    },
    rulerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        height: 20,
        paddingHorizontal: 5,
    },
    rulerRowBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        height: 20,
        paddingHorizontal: 5,
        alignItems: 'flex-end',
    },
    tickMark: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    rulerMiddleRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    rulerCol: {
        width: 20,
        height: '100%',
        justifyContent: 'space-between',
        paddingVertical: 5,
    },
    rulerColRight: {
        width: 20,
        height: '100%',
        justifyContent: 'space-between',
        paddingVertical: 5,
        alignItems: 'flex-end',
    },
    tickMarkHorz: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    emptyTargetArea: {
        flex: 1,
        margin: 20,
    },
});
