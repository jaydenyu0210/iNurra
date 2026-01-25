import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, ScrollView, Dimensions, Text as RNText, Alert } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, FAB, Chip, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { tokens } from '../../src/theme';
import Svg, { Path, Circle } from 'react-native-svg';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';
import { deleteHealthMetric } from '../../src/services/api';

const { width } = Dimensions.get('window');

interface HealthMetric {
    id: string;
    metric_type: string;
    value: number;
    unit: string;
    recorded_at: string;
}

type TimeRange = '7d' | '30d';

// Simple Line Chart Component using SVG
interface SimpleLineChartProps {
    data: number[];
    labels: string[];
    width: number;
    height: number;
    lineColor: string;
    fillColor: string;
    labelColor: string;
}

function SimpleLineChart({ data, labels, width, height, lineColor, fillColor, labelColor }: SimpleLineChartProps) {
    if (data.length === 0) return null;

    const padding = { top: 20, bottom: 30, left: 40, right: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const minValue = Math.min(...data) * 0.95;
    const maxValue = Math.max(...data) * 1.05;
    const range = maxValue - minValue || 1;

    const points = data.map((value, index) => {
        const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
        const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
        return { x, y };
    });

    // Create line path
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Create area path (closed polygon for fill)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

    // Y-axis label positions
    const yAxisLabels = [minValue, (minValue + maxValue) / 2, maxValue].map((value) => {
        const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
        return { value, y };
    });

    return (
        <View style={{ width, height, position: 'relative' }}>
            {/* Y-axis labels */}
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: padding.bottom, width: padding.left, justifyContent: 'space-between', paddingTop: padding.top, paddingBottom: padding.bottom }}>
                {yAxisLabels.map((label, i) => (
                    <RNText key={i} style={{ fontSize: 10, color: labelColor, textAlign: 'right', paddingRight: 5 }}>
                        {label.value.toFixed(1)}
                    </RNText>
                ))}
            </View>

            <Svg width={width} height={height}>
                {/* Y-axis line */}
                <Path d={`M ${padding.left} ${padding.top} L ${padding.left} ${height - padding.bottom}`} stroke={labelColor} strokeWidth={1} opacity={0.3} />

                {/* Area fill */}
                <Path d={areaPath} fill={fillColor} fillOpacity={0.3} />
                {/* Line */}
                <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" />
                {/* Data points */}
                {points.map((p, i) => (
                    <Circle key={i} cx={p.x} cy={p.y} r={4} fill={lineColor} />
                ))}
            </Svg>
            {/* X-axis labels */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: padding.left, marginTop: 5 }}>
                {labels.filter((_, i) => i === 0 || i === labels.length - 1 || i === Math.floor(labels.length / 2)).map((label, i) => (
                    <RNText key={i} style={{ fontSize: 10, color: labelColor }}>{label}</RNText>
                ))}
            </View>
        </View>
    );
}

export default function HealthScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMetricType, setSelectedMetricType] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('7d');

    const fetchMetrics = useCallback(async () => {
        if (!user?.id) return;

        try {
            const { data, error } = await supabase
                .from('health_metrics')
                .select('*')
                .eq('user_id', user.id)
                .order('recorded_at', { ascending: false });

            if (error) throw error;
            setHealthMetrics((data as any) || []);

            // Set first metric type as selected if available
            const metrics = (data as any[]) || [];
            if (metrics.length > 0 && !selectedMetricType) {
                const types = [...new Set(metrics.map(m => m.metric_type))];
                setSelectedMetricType(types[0]);
            }
        } catch (error) {
            console.error('Error fetching metrics:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    // Refetch when screen comes into focus to show fresh data
    useFocusEffect(
        useCallback(() => {
            fetchMetrics();
        }, [fetchMetrics])
    );

    const handleDelete = (metricId: string, metricType: string) => {
        Alert.alert(
            'Delete Metric',
            `Are you sure you want to delete this ${metricType} reading?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const prevMetrics = healthMetrics;
                        setHealthMetrics(m => m.filter(metric => metric.id !== metricId));
                        try {
                            await deleteHealthMetric(metricId);
                        } catch (error) {
                            setHealthMetrics(prevMetrics);
                            Alert.alert('Error', 'Failed to delete metric');
                        }
                    },
                },
            ]
        );
    };

    // Group metrics by type
    const metricTypes = [...new Set(healthMetrics.map(m => m.metric_type))];
    const selectedMetrics = healthMetrics.filter(m => m.metric_type === selectedMetricType);

    const getMetricIcon = (type: string) => {
        const lower = type.toLowerCase();
        if (lower.includes('blood') && lower.includes('pressure')) return 'heart-pulse';
        if (lower.includes('glucose')) return 'water';
        if (lower.includes('heart') || lower.includes('pulse')) return 'heart';
        if (lower.includes('weight')) return 'scale-bathroom';
        if (lower.includes('cholesterol')) return 'test-tube';
        return 'chart-line';
    };

    const getAverageValue = (type: string) => {
        const typeMetrics = healthMetrics.filter(m => m.metric_type === type);
        if (typeMetrics.length === 0) return null;
        const sum = typeMetrics.reduce((acc, m) => acc + m.value, 0);
        const avg = sum / typeMetrics.length;
        return {
            value: avg,
            unit: typeMetrics[0].unit
        };
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    size={24}
                    onPress={() => router.replace('/(tabs)')}
                />
                <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                    Health Metrics
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : healthMetrics.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="chart-line" size={64} color={theme.colors.outline} />
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: tokens.spacing.lg }}>
                        No Health Metrics Uploaded
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: tokens.spacing.sm }}>
                        Upload a photo of your health metrics from a medical device
                    </Text>
                    <Button
                        mode="contained"
                        style={{ marginTop: tokens.spacing.lg }}
                        onPress={() => router.push('/documents/upload')}
                    >
                        Upload
                    </Button>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <View style={{ paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.xs, marginTop: tokens.spacing.md }}>
                        <Text variant="titleMedium" style={{ color: theme.colors.onBackground, fontWeight: '600' }}>Average</Text>
                    </View>
                    {/* Metrics Type Selector */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.metricsScroll}
                        style={styles.metricsScrollContainer}
                    >
                        {metricTypes.map((type) => {
                            const average = getAverageValue(type);
                            const isSelected = selectedMetricType === type;
                            return (
                                <Card
                                    key={type}
                                    style={[
                                        styles.metricCard,
                                        isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
                                    ]}
                                    mode="elevated"
                                    onPress={() => setSelectedMetricType(type)}
                                >
                                    <Card.Content style={styles.metricCardContent}>
                                        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {type}
                                        </Text>
                                        {average && (
                                            <View style={styles.metricValueRow}>
                                                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                                    {average.value.toFixed(1)}
                                                </Text>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                    {average.unit}
                                                </Text>
                                            </View>
                                        )}
                                    </Card.Content>
                                </Card>
                            );
                        })}
                    </ScrollView>

                    {/* Chart Section */}
                    {selectedMetricType && selectedMetrics.length > 0 && (
                        <View style={styles.chartSection}>
                            <View style={styles.chartHeader}>
                                <Text variant="titleMedium" style={{ color: theme.colors.onBackground, fontWeight: '600' }}>
                                    {selectedMetricType} Trend
                                </Text>
                            </View>

                            {/* Time Range Selector */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRangeScroll}>
                                <View style={styles.timeRangeContainer}>
                                    {(['7d', '30d'] as TimeRange[]).map((range) => (
                                        <Chip
                                            key={range}
                                            selected={timeRange === range}
                                            onPress={() => setTimeRange(range)}
                                            mode={timeRange === range ? 'flat' : 'outlined'}
                                            style={timeRange === range ? { backgroundColor: theme.colors.primaryContainer } : {}}
                                        >
                                            {range === '7d' ? '7 Days' : '30 Days'}
                                        </Chip>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* Chart */}
                            <Card style={styles.chartCard} mode="elevated">
                                <Card.Content>
                                    <SimpleLineChart
                                        data={selectedMetrics
                                            .slice(0, timeRange === '7d' ? 7 : 30)
                                            .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
                                            .map(m => m.value)}
                                        labels={selectedMetrics
                                            .slice(0, timeRange === '7d' ? 7 : 30)
                                            .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
                                            .map(m => format(new Date(m.recorded_at), 'MMM d'))}
                                        width={width - 80}
                                        height={180}
                                        lineColor={theme.colors.primary}
                                        fillColor={theme.colors.primaryContainer}
                                        labelColor={theme.colors.onSurfaceVariant}
                                    />
                                </Card.Content>
                            </Card>
                        </View>
                    )}

                    {/* Recent Entries */}
                    <View style={styles.recentSection}>
                        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                            {selectedMetricType ? `${selectedMetricType} History` : 'All Readings'}
                        </Text>

                        {(selectedMetricType ? selectedMetrics : healthMetrics).slice(0, 10).map((metric) => (
                            <Card
                                key={metric.id}
                                style={styles.entryCard}
                                mode="outlined"
                                onPress={() => router.push(`/health/${metric.id}`)}
                            >
                                <Card.Content style={styles.entryContent}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                                            {metric.value} {metric.unit}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {format(new Date(metric.recorded_at), 'MMM d, yyyy h:mm a')}
                                        </Text>
                                    </View>
                                    <IconButton
                                        icon="delete-outline"
                                        size={20}
                                        iconColor={theme.colors.error}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDelete(metric.id, metric.metric_type);
                                        }}
                                    />
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* Add Metric FAB */}

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
        paddingHorizontal: tokens.spacing.sm,
        paddingTop: tokens.spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.xl,
    },
    scrollView: {
        flex: 1,
    },
    metricsScrollContainer: {
        marginBottom: tokens.spacing.lg,
    },
    metricsScroll: {
        paddingHorizontal: tokens.spacing.lg,
        gap: tokens.spacing.md,
    },
    metricCard: {
        width: 140,
        borderRadius: tokens.radius.lg,
    },
    metricCardContent: {
        gap: tokens.spacing.xs,
    },
    metricValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: tokens.spacing.xs,
    },
    chartSection: {
        paddingHorizontal: tokens.spacing.lg,
    },
    chartHeader: {
        marginBottom: tokens.spacing.md,
    },
    timeRangeScroll: {
        marginBottom: tokens.spacing.md,
    },
    timeRangeContainer: {
        flexDirection: 'row',
        gap: tokens.spacing.sm,
    },
    chartCard: {
        borderRadius: tokens.radius.lg,
        marginBottom: tokens.spacing.lg,
    },
    recentSection: {
        paddingHorizontal: tokens.spacing.lg,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: tokens.spacing.md,
    },
    entryCard: {
        marginBottom: tokens.spacing.sm,
        borderRadius: tokens.radius.md,
    },
    entryContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fab: {
        position: 'absolute',
        right: tokens.spacing.lg,
        bottom: tokens.spacing.lg,
    },
});
