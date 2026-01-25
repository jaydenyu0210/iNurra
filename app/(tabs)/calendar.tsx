import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Alert } from 'react-native';
import { Text, Card, Button, SegmentedButtons, useTheme, IconButton, Chip, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO, isSameDay, startOfWeek, addDays } from 'date-fns';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';

const { width, height } = Dimensions.get('window');
const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    type: 'medication' | 'appointment' | 'todo' | 'reminder';
    scheduled_at: string;
    duration_minutes?: number;
    completed: boolean;
    medication_id?: string;
}

type ViewMode = 'day' | 'week' | 'month';

export default function CalendarScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const scrollViewRef = useRef<ScrollView>(null);

    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Fetch events
    const fetchEvents = useCallback(async () => {
        if (!user?.id) return;

        try {
            const startDate = new Date(selectedDate);
            startDate.setDate(startDate.getDate() - 7);
            const endDate = new Date(selectedDate);
            endDate.setDate(endDate.getDate() + 30);

            const { data, error } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', user.id)
                .gte('scheduled_at', startDate.toISOString())
                .lte('scheduled_at', endDate.toISOString())
                .order('scheduled_at', { ascending: true });

            if (error) throw error;
            setEvents(data || []);
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id, selectedDate]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Scroll to current time on mount
    useEffect(() => {
        if (viewMode === 'day' && scrollViewRef.current) {
            const hour = new Date().getHours();
            const scrollY = Math.max(0, (hour - 2) * HOUR_HEIGHT);
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
            }, 300);
        }
    }, [viewMode]);

    const getEventColor = (type: string) => {
        switch (type) {
            case 'medication': return theme.colors.primary;
            case 'appointment': return theme.colors.tertiary;
            case 'todo': return theme.colors.secondary;
            case 'reminder': return '#FBBC04';
            default: return theme.colors.outline;
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'medication': return 'pill';
            case 'appointment': return 'calendar-account';
            case 'todo': return 'checkbox-marked-circle-outline';
            case 'reminder': return 'bell';
            default: return 'calendar';
        }
    };

    const handleEventPress = (event: CalendarEvent) => {
        Alert.alert(
            event.title,
            `${event.description || ''}\n\nTime: ${format(parseISO(event.scheduled_at), 'h:mm a')}\nStatus: ${event.completed ? 'Completed' : 'Pending'}`,
            [
                { text: 'Close', style: 'cancel' },
                {
                    text: event.completed ? 'Mark Incomplete' : 'Mark Complete',
                    onPress: async () => {
                        try {
                            await supabase
                                .from('calendar_events')
                                .update({ completed: !event.completed } as any)
                                .eq('id', event.id);
                            fetchEvents();
                        } catch (error) {
                            console.error('Error updating event:', error);
                        }
                    },
                },
            ]
        );
    };

    const getEventsForDate = (date: string) => {
        return events.filter(event => {
            const eventDate = format(parseISO(event.scheduled_at), 'yyyy-MM-dd');
            return eventDate === date;
        });
    };

    const formatHour = (hour: number) => {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour} ${ampm}`;
    };

    // Calculate current time indicator position
    const getCurrentTimePosition = () => {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        return (hours + minutes / 60) * HOUR_HEIGHT;
    };

    // Day View Component
    const renderDayView = () => {
        const dayEvents = getEventsForDate(selectedDate);
        const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

        return (
            <ScrollView
                ref={scrollViewRef}
                style={styles.dayScrollView}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.dayGrid}>
                    {HOURS.map((hour) => (
                        <View key={hour} style={[styles.hourRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                            <Text variant="labelSmall" style={[styles.hourLabel, { color: theme.colors.onSurfaceVariant }]}>
                                {formatHour(hour)}
                            </Text>
                            <View style={styles.hourContent} />
                        </View>
                    ))}

                    {/* Current time indicator */}
                    {isToday && (
                        <View style={[styles.currentTimeIndicator, { top: getCurrentTimePosition() }]}>
                            <View style={[styles.currentTimeDot, { backgroundColor: theme.colors.error }]} />
                            <View style={[styles.currentTimeLine, { backgroundColor: theme.colors.error }]} />
                        </View>
                    )}

                    {/* Events */}
                    {(() => {
                        // Group events by time slot to handle overlaps
                        const eventsByTime: Record<string, CalendarEvent[]> = {};
                        dayEvents.forEach(event => {
                            const eventTime = parseISO(event.scheduled_at);
                            const hour = eventTime.getHours();
                            const minutes = eventTime.getMinutes();
                            const timeKey = `${hour}:${Math.floor(minutes / 15) * 15}`; // 15-min buckets
                            if (!eventsByTime[timeKey]) {
                                eventsByTime[timeKey] = [];
                            }
                            eventsByTime[timeKey].push(event);
                        });

                        // Calculate position for each event
                        const eventPositions: Record<string, { column: number; totalColumns: number }> = {};
                        Object.values(eventsByTime).forEach(eventsAtTime => {
                            eventsAtTime.forEach((event, index) => {
                                eventPositions[event.id] = {
                                    column: index,
                                    totalColumns: eventsAtTime.length,
                                };
                            });
                        });

                        return dayEvents.map((event) => {
                            const eventTime = parseISO(event.scheduled_at);
                            const hour = eventTime.getHours();
                            const minutes = eventTime.getMinutes();
                            const top = (hour + minutes / 60) * HOUR_HEIGHT;
                            const eventHeight = Math.max(40, (event.duration_minutes || 30) * (HOUR_HEIGHT / 60));

                            const { column, totalColumns } = eventPositions[event.id];
                            const availableWidth = width - 55 - 16; // Total width minus left margin and right padding
                            const eventWidth = availableWidth / totalColumns;
                            const leftOffset = 55 + (column * eventWidth);

                            return (
                                <Card
                                    key={event.id}
                                    style={[
                                        styles.eventCard,
                                        {
                                            top,
                                            left: leftOffset,
                                            width: eventWidth - 4, // Small gap between events
                                            height: eventHeight,
                                            backgroundColor: getEventColor(event.type) + '20',
                                            borderLeftColor: getEventColor(event.type),
                                            opacity: event.completed ? 0.6 : 1,
                                        },
                                    ]}
                                    onPress={() => handleEventPress(event)}
                                >
                                    <View style={styles.eventCardContent}>
                                        <Text
                                            variant="labelSmall"
                                            style={[
                                                { color: theme.colors.onSurface, flex: 1 },
                                                event.completed && styles.completedText,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {event.title}
                                        </Text>
                                    </View>
                                </Card>
                            );
                        });
                    })()}
                </View>
            </ScrollView>
        );
    };

    // Week View Component
    const renderWeekView = () => {
        const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 0 });
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

        return (
            <ScrollView style={styles.weekScrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.weekHeader}>
                    {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isSelected = dateStr === selectedDate;
                        const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                        return (
                            <Card
                                key={dateStr}
                                style={[
                                    styles.weekDayCard,
                                    isSelected && { backgroundColor: theme.colors.primaryContainer },
                                ]}
                                onPress={() => setSelectedDate(dateStr)}
                            >
                                <Text
                                    variant="labelSmall"
                                    style={{ color: isToday ? theme.colors.primary : theme.colors.onSurfaceVariant }}
                                >
                                    {format(day, 'EEE')}
                                </Text>
                                <Text
                                    variant="titleMedium"
                                    style={{
                                        color: isToday ? theme.colors.primary : theme.colors.onSurface,
                                        fontWeight: isSelected ? '700' : '400',
                                    }}
                                >
                                    {format(day, 'd')}
                                </Text>
                            </Card>
                        );
                    })}
                </View>

                {/* Events for selected day */}
                <View style={styles.weekEvents}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                        {format(parseISO(selectedDate), 'EEEE, MMMM d')}
                    </Text>
                    {getEventsForDate(selectedDate).length === 0 ? (
                        <Card style={styles.emptyCard} mode="outlined">
                            <Card.Content style={styles.emptyContent}>
                                <MaterialCommunityIcons name="calendar-blank" size={32} color={theme.colors.outline} />
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: tokens.spacing.sm }}>
                                    No events scheduled
                                </Text>
                            </Card.Content>
                        </Card>
                    ) : (
                        getEventsForDate(selectedDate).map((event) => (
                            <Card key={event.id} style={styles.listEventCard} mode="elevated" onPress={() => handleEventPress(event)}>
                                <Card.Content style={styles.listEventContent}>
                                    <View style={[styles.eventIcon, { backgroundColor: getEventColor(event.type) + '20' }]}>
                                        <MaterialCommunityIcons
                                            name={getEventIcon(event.type) as any}
                                            size={24}
                                            color={getEventColor(event.type)}
                                        />
                                    </View>
                                    <View style={styles.eventInfo}>
                                        <Text
                                            variant="bodyLarge"
                                            style={[
                                                { color: theme.colors.onSurface },
                                                event.completed && styles.completedText,
                                            ]}
                                        >
                                            {event.title}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {format(parseISO(event.scheduled_at), 'h:mm a')}
                                        </Text>
                                    </View>
                                    <Chip
                                        compact
                                        mode={event.completed ? 'flat' : 'outlined'}
                                        style={event.completed ? { backgroundColor: theme.colors.secondaryContainer } : {}}
                                    >
                                        {event.completed ? 'Done' : 'Mark'}
                                    </Chip>
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </View>
            </ScrollView>
        );
    };

    // Month View Component (existing calendar)
    const renderMonthView = () => {
        const markedDates: Record<string, any> = {};

        events.forEach(event => {
            const dateStr = format(parseISO(event.scheduled_at), 'yyyy-MM-dd');
            if (!markedDates[dateStr]) {
                markedDates[dateStr] = { dots: [] };
            }
            markedDates[dateStr].dots.push({
                key: event.id,
                color: getEventColor(event.type),
            });
        });

        markedDates[selectedDate] = {
            ...markedDates[selectedDate],
            selected: true,
            selectedColor: theme.colors.primary,
        };

        return (
            <ScrollView style={styles.monthScrollView} showsVerticalScrollIndicator={false}>
                <RNCalendar
                    current={selectedDate}
                    onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                    markingType="multi-dot"
                    markedDates={markedDates}
                    theme={{
                        backgroundColor: theme.colors.background,
                        calendarBackground: theme.colors.background,
                        textSectionTitleColor: theme.colors.onSurfaceVariant,
                        selectedDayBackgroundColor: theme.colors.primary,
                        selectedDayTextColor: theme.colors.onPrimary,
                        todayTextColor: theme.colors.primary,
                        dayTextColor: theme.colors.onBackground,
                        textDisabledColor: theme.colors.outline,
                        dotColor: theme.colors.primary,
                        monthTextColor: theme.colors.onBackground,
                        arrowColor: theme.colors.primary,
                        textDayFontWeight: '500',
                        textMonthFontWeight: '600',
                        textDayHeaderFontWeight: '500',
                    }}
                    style={styles.calendar}
                />

                {/* Events for selected date */}
                <View style={styles.monthEvents}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                        {format(parseISO(selectedDate), 'EEEE, MMMM d')}
                    </Text>
                    {getEventsForDate(selectedDate).length === 0 ? (
                        <Card style={styles.emptyCard} mode="outlined">
                            <Card.Content style={styles.emptyContent}>
                                <MaterialCommunityIcons name="calendar-blank" size={32} color={theme.colors.outline} />
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: tokens.spacing.sm }}>
                                    No events scheduled
                                </Text>
                            </Card.Content>
                        </Card>
                    ) : (
                        getEventsForDate(selectedDate).map((event) => (
                            <Card key={event.id} style={styles.listEventCard} mode="elevated" onPress={() => handleEventPress(event)}>
                                <Card.Content style={styles.listEventContent}>
                                    <View style={[styles.eventIcon, { backgroundColor: getEventColor(event.type) + '20' }]}>
                                        <MaterialCommunityIcons
                                            name={getEventIcon(event.type) as any}
                                            size={24}
                                            color={getEventColor(event.type)}
                                        />
                                    </View>
                                    <View style={styles.eventInfo}>
                                        <Text
                                            variant="bodyLarge"
                                            style={[
                                                { color: theme.colors.onSurface },
                                                event.completed && styles.completedText,
                                            ]}
                                        >
                                            {event.title}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {format(parseISO(event.scheduled_at), 'h:mm a')}
                                        </Text>
                                    </View>
                                    <Chip
                                        compact
                                        mode={event.completed ? 'flat' : 'outlined'}
                                        style={event.completed ? { backgroundColor: theme.colors.secondaryContainer } : {}}
                                    >
                                        {event.completed ? 'Done' : 'Mark'}
                                    </Chip>
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </View>
            </ScrollView>
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
                <Text variant="headlineSmall" style={{ color: theme.colors.onBackground, fontWeight: '600', flex: 1 }}>
                    Calendar
                </Text>
            </View>

            {/* View Mode Toggle */}
            <View style={styles.viewToggle}>
                <SegmentedButtons
                    value={viewMode}
                    onValueChange={(value) => setViewMode(value as ViewMode)}
                    buttons={[
                        { value: 'day', label: 'Day' },
                        { value: 'week', label: 'Week' },
                        { value: 'month', label: 'Month' },
                    ]}
                    style={styles.segmentedButtons}
                />
            </View>

            {/* Date Navigation for Day View */}
            {viewMode === 'day' && (
                <View style={styles.dateNav}>
                    <IconButton
                        icon="chevron-left"
                        size={24}
                        onPress={() => {
                            const prev = addDays(parseISO(selectedDate), -1);
                            setSelectedDate(format(prev, 'yyyy-MM-dd'));
                        }}
                    />
                    <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
                        {format(parseISO(selectedDate), 'EEEE, MMM d')}
                    </Text>
                    <IconButton
                        icon="chevron-right"
                        size={24}
                        onPress={() => {
                            const next = addDays(parseISO(selectedDate), 1);
                            setSelectedDate(format(next, 'yyyy-MM-dd'));
                        }}
                    />
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <>
                    {viewMode === 'day' && renderDayView()}
                    {viewMode === 'week' && renderWeekView()}
                    {viewMode === 'month' && renderMonthView()}
                </>
            )}
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
    viewToggle: {
        paddingHorizontal: tokens.spacing.lg,
        marginBottom: tokens.spacing.md,
    },
    segmentedButtons: {
        borderRadius: tokens.radius.xl,
    },
    dateNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: tokens.spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Day View
    dayScrollView: {
        flex: 1,
    },
    dayGrid: {
        position: 'relative',
        paddingBottom: 100,
    },
    hourRow: {
        height: HOUR_HEIGHT,
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    hourLabel: {
        width: 50,
        textAlign: 'right',
        paddingRight: tokens.spacing.sm,
        paddingTop: tokens.spacing.xs,
    },
    hourContent: {
        flex: 1,
        borderLeftWidth: 1,
        borderLeftColor: '#e0e0e0',
    },
    currentTimeIndicator: {
        position: 'absolute',
        left: 45,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    currentTimeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    currentTimeLine: {
        flex: 1,
        height: 2,
    },
    eventCard: {
        position: 'absolute',
        borderRadius: tokens.radius.sm,
        borderLeftWidth: 3,
        overflow: 'hidden',
    },
    eventCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: tokens.spacing.xs,
        paddingHorizontal: tokens.spacing.sm,
    },
    completedText: {
        textDecorationLine: 'line-through',
        opacity: 0.6,
    },
    // Week View
    weekScrollView: {
        flex: 1,
    },
    weekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: tokens.spacing.sm,
        marginBottom: tokens.spacing.md,
    },
    weekDayCard: {
        width: (width - 40) / 7,
        padding: tokens.spacing.xs,
        alignItems: 'center',
        borderRadius: tokens.radius.md,
    },
    weekEvents: {
        paddingHorizontal: tokens.spacing.lg,
        paddingBottom: 100,
    },
    // Month View
    monthScrollView: {
        flex: 1,
    },
    calendar: {
        marginHorizontal: tokens.spacing.md,
        borderRadius: tokens.radius.lg,
    },
    monthEvents: {
        paddingHorizontal: tokens.spacing.lg,
        paddingTop: tokens.spacing.lg,
        paddingBottom: 100,
    },
    // Shared
    sectionTitle: {
        fontWeight: '600',
        marginBottom: tokens.spacing.md,
    },
    emptyCard: {
        borderRadius: tokens.radius.lg,
    },
    emptyContent: {
        alignItems: 'center',
        paddingVertical: tokens.spacing.xl,
    },
    listEventCard: {
        marginBottom: tokens.spacing.sm,
        borderRadius: tokens.radius.md,
    },
    listEventContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.md,
    },
    eventIcon: {
        width: 44,
        height: 44,
        borderRadius: tokens.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    eventInfo: {
        flex: 1,
    },
});
