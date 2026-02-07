import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, SegmentedButtons, useTheme, IconButton, Chip, ActivityIndicator, Portal, Dialog, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO, isSameDay, startOfWeek, addDays } from 'date-fns';
import { tokens } from '../../src/theme';
import { supabase } from '../../src/services/supabase';
import { useAuth } from '../../src/hooks';

const { width, height } = Dimensions.get('window');
const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface AppCalendarEvent {
    id: string;
    title: string;
    description?: string;
    type: 'medication' | 'appointment' | 'todo' | 'reminder';
    scheduled_at: string;
    duration_minutes?: number;
    completed: boolean;
    medication_id?: string;
    todo_item_id?: string;
    frequency_days?: number;
    duration_days?: number;
}

type ViewMode = 'day' | 'week' | 'month';

export default function CalendarScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const { initialViewMode } = useLocalSearchParams<{ initialViewMode?: ViewMode }>();
    const scrollViewRef = useRef<ScrollView>(null);

    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [viewMode, setViewMode] = useState<ViewMode>((initialViewMode as ViewMode) || 'day');

    // Update view mode if params change (forcing tab switch)
    useEffect(() => {
        if (initialViewMode) {
            setViewMode(initialViewMode as ViewMode);
        }
    }, [initialViewMode]);

    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Edit Todo State
    const [editingTodo, setEditingTodo] = useState<AppCalendarEvent | null>(null);
    const [editTodoTitle, setEditTodoTitle] = useState('');
    const [editTodoFrequency, setEditTodoFrequency] = useState<string | undefined>(undefined);
    const [editTodoDuration, setEditTodoDuration] = useState<string | undefined>(undefined);
    const [editDialogVisible, setEditDialogVisible] = useState(false);

    // Fetch events (from calendar_events table + generate from medications)
    const fetchEvents = useCallback(async () => {
        if (!user?.id || !supabase) return;

        try {
            const startDate = new Date(selectedDate);
            startDate.setDate(startDate.getDate() - 7);
            const endDate = new Date(selectedDate);
            endDate.setDate(endDate.getDate() + 30);

            // Fetch existing calendar events
            const { data: calendarData, error: calendarError } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', user.id)
                .gte('scheduled_at', startDate.toISOString())
                .lte('scheduled_at', endDate.toISOString())
                .order('scheduled_at', { ascending: true });

            if (calendarError) throw calendarError;

            // Fetch VALID todo items (non-null frequency and duration) to filter out orphans
            const { data: validTodos, error: todoError } = await supabase
                .from('todo_items')
                .select('id')
                .eq('user_id', user.id)
                .not('frequency_days', 'is', null)
                .not('duration_days', 'is', null);

            if (todoError) throw todoError;

            const validTodoIds = new Set((validTodos as any[] || []).map(t => t.id));

            // Filter calendar events:
            // 1. Keep non-todo events
            // 2. Keep todo events ONLY if they belong to a valid todo item
            const filteredCalendarEvents = (calendarData || []).filter((e: any) => {
                if (e.type !== 'todo') return true;
                return e.todo_item_id && validTodoIds.has(e.todo_item_id);
            });

            // Also fetch active medications to generate events on-the-fly
            const { data: medications, error: medError } = await supabase
                .from('medications')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true);

            if (medError) throw medError;

            // Generate medication events from frequency/duration if not already in calendar_events
            const medicationEvents: AppCalendarEvent[] = [];

            // Track which medications already have events in the database
            const medsWithExistingEvents = new Set(
                filteredCalendarEvents
                    .filter((e: any) => e.type === 'medication' && e.medication_id)
                    .map((e: any) => e.medication_id)
            );

            (medications || []).forEach((med: any) => {
                // Skip if this medication already has events in the database
                if (medsWithExistingEvents.has(med.id)) {
                    console.log(`Medication: ${med.name} - already has events in DB, skipping generation`);
                    return;
                }

                console.log(`Medication: ${med.name}, frequency=${med.frequency}, duration_days=${med.duration_days}, start_date=${med.start_date}, end_date=${med.end_date}`);

                if (!med.frequency || med.frequency <= 0) {
                    console.log(`  -> Skipping: no valid frequency`);
                    return;
                }

                const medStartDate = med.start_date ? new Date(med.start_date) : new Date();
                const durationDays = med.duration_days || 7;
                const medEndDate = med.end_date ? new Date(med.end_date) : new Date(medStartDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

                console.log(`  -> medStartDate=${medStartDate.toISOString()}, medEndDate=${medEndDate.toISOString()}`);
                console.log(`  -> Query range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

                // Generate events for each day based on frequency
                const eventTimes: number[] = [];
                let currentHour = 8; // Start at 8 AM instead of midnight for better UX
                while (currentHour < 24) {
                    eventTimes.push(currentHour);
                    currentHour += med.frequency;
                }

                // Create events for each day in range
                const current = new Date(Math.max(medStartDate.getTime(), startDate.getTime()));
                const end = new Date(Math.min(medEndDate.getTime(), endDate.getTime()));

                while (current <= end) {
                    for (const hour of eventTimes) {
                        const eventDateTime = new Date(current);
                        eventDateTime.setHours(hour, 0, 0, 0);

                        medicationEvents.push({
                            id: `virtual-${med.id}-${eventDateTime.getTime()}`,
                            title: `💊 ${med.name} ${med.dosage || ''}`.trim(),
                            description: `Take medication - Every ${med.frequency} hours`,
                            type: 'medication',
                            scheduled_at: eventDateTime.toISOString(),
                            duration_minutes: 15,
                            completed: false,
                            medication_id: med.id,
                        });
                    }
                    current.setDate(current.getDate() + 1);
                }
            });

            // Combine and sort all events
            const allEvents = [...filteredCalendarEvents, ...medicationEvents].sort((a, b) =>
                new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
            );

            console.log(`Calendar: Total events = ${allEvents.length}, from DB = ${filteredCalendarEvents.length}, generated = ${medicationEvents.length}`);

            setEvents(allEvents as AppCalendarEvent[]);
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

    const handleEventPress = (event: AppCalendarEvent) => {
        if (event.type === 'todo') {
            Alert.alert(
                event.title,
                `${event.description || ''}\nStatus: ${event.completed ? 'Completed' : 'Pending'}`,
                [
                    { text: 'Close', style: 'cancel' },
                    {
                        text: 'Edit Task',
                        onPress: async () => {
                            // Fetch full todo details to get frequency/duration
                            if (event.todo_item_id && supabase) {
                                const { data } = await supabase
                                    .from('todo_items')
                                    .select('*')
                                    .eq('id', event.todo_item_id)
                                    .single();

                                const todoData = data as any;

                                if (todoData) {
                                    setEditTodoTitle(todoData.title);
                                    setEditTodoFrequency(todoData.frequency_days ? String(todoData.frequency_days) : '');
                                    setEditTodoDuration(todoData.duration_days ? String(todoData.duration_days) : '');
                                    setEditingTodo({ ...event, frequency_days: todoData.frequency_days, duration_days: todoData.duration_days });
                                    setEditDialogVisible(true);
                                }
                            }
                        }
                    },
                    {
                        text: event.completed ? 'Mark Incomplete' : 'Mark Complete',
                        onPress: async () => {
                            if (supabase) {
                                await supabase
                                    .from('calendar_events')
                                    .update({ completed: !event.completed } as any)
                                    .eq('id', event.id);

                                // Also update the todo item itself
                                if (event.todo_item_id) {
                                    await supabase
                                        .from('todo_items')
                                        .update({ completed: !event.completed } as any)
                                        .eq('id', event.todo_item_id);
                                }
                                fetchEvents();
                            }
                        },
                    },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                            Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                        if (event.todo_item_id && supabase) {
                                            // Delete Calendar Events first (foreign key might cascade, but be safe)
                                            await supabase
                                                .from('calendar_events')
                                                .delete()
                                                .eq('todo_item_id', event.todo_item_id);

                                            // Delete Todo Item
                                            await supabase
                                                .from('todo_items')
                                                .delete()
                                                .eq('id', event.todo_item_id);

                                            fetchEvents();
                                        }
                                    }
                                }
                            ]);
                        }
                    }
                ]
            );
        } else {
            Alert.alert(
                event.title,
                `${event.description || ''}\n\nTime: ${format(parseISO(event.scheduled_at), 'h:mm a')}\nStatus: ${event.completed ? 'Completed' : 'Pending'}`,
                [
                    { text: 'Close', style: 'cancel' },
                    {
                        text: event.completed ? 'Mark Incomplete' : 'Mark Complete',
                        onPress: async () => {
                            try {
                                if (supabase) {
                                    await supabase
                                        .from('calendar_events')
                                        .update({ completed: !event.completed } as any)
                                        .eq('id', event.id);
                                    fetchEvents();
                                }
                            } catch (error) {
                                console.error('Error updating event:', error);
                            }
                        },
                    },
                ]
            );
        }
    };

    const saveTodoEdit = async () => {
        if (!editingTodo || !editingTodo.todo_item_id) return;
        setEditDialogVisible(false); // Close immediately

        try {
            const freq = editTodoFrequency ? parseInt(editTodoFrequency) : null;
            const dur = editTodoDuration ? parseInt(editTodoDuration) : null;

            // 1. Update Todo Item
            if (supabase) {
                const { error: updateError } = await supabase
                    .from('todo_items')
                    .update({
                        title: editTodoTitle,
                        frequency_days: freq,
                        duration_days: dur
                    } as any)
                    .eq('id', editingTodo.todo_item_id);

                if (updateError) throw updateError;

                // 2. Regenerate Calendar Events (Delete old future events, Create new ones)
                // Delete all future events for this todo
                const { error: deleteError } = await supabase
                    .from('calendar_events')
                    .delete()
                    .eq('todo_item_id', editingTodo.todo_item_id)
                    .gte('scheduled_at', new Date().toISOString());

                if (deleteError) throw deleteError;

                // Create new events
                const startDate = new Date(); // Start from today
                const durationDays = dur || 1;
                const frequencyDays = freq;

                const calendarEvents: any[] = [];
                // Same logic as upload.tsx
                if (frequencyDays) {
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + durationDays);
                    let currentDate = new Date(startDate);
                    let dayCount = 0;
                    while (dayCount < durationDays) {
                        // Only add if it's in the future (or today)
                        if (currentDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
                            calendarEvents.push({
                                user_id: user?.id,
                                todo_item_id: editingTodo.todo_item_id,
                                title: editTodoTitle,
                                description: editingTodo.description,
                                type: 'todo',
                                source_type: 'todo',
                                scheduled_at: currentDate.toISOString(),
                                duration_minutes: 30,
                                completed: false
                            });
                        }
                        currentDate.setDate(currentDate.getDate() + frequencyDays);
                        dayCount += frequencyDays;
                    }
                } else {
                    // Single event if no frequency, only if it hasn't passed? 
                    // Or update the existing one? Complex.
                    // Let's assume user wants to reschedule to Today if they edit without frequency.
                    calendarEvents.push({
                        user_id: user?.id,
                        todo_item_id: editingTodo.todo_item_id,
                        title: editTodoTitle,
                        description: editingTodo.description,
                        type: 'todo',
                        source_type: 'todo',
                        scheduled_at: new Date().toISOString(), // Reset to today
                        duration_minutes: 30,
                        completed: false
                    });
                }

                if (calendarEvents.length > 0) {
                    await supabase
                        .from('calendar_events')
                        .insert(calendarEvents as any);
                }

                fetchEvents();
            }
        } catch (error) {
            console.error('Error saving todo:', error);
            Alert.alert('Error', 'Failed to save changes');
        }
    };

    const getEventsForDate = (date: string): AppCalendarEvent[] => {
        return events.filter(event => {
            const eventDate = format(parseISO(event.scheduled_at), 'yyyy-MM-dd');
            // Day View: Hide Todos
            if (viewMode === 'day' && event.type === 'todo') return false;
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
                        const eventsByTime: Record<string, AppCalendarEvent[]> = {};
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
                                            {event.type === 'todo'
                                                ? format(parseISO(event.scheduled_at), 'MMM d') // Date only for todos
                                                : format(parseISO(event.scheduled_at), 'h:mm a') // Time for others
                                            }
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

    // Month View Component (Custom Full Screen with Text)
    const renderMonthView = () => {
        // Calculate cell height based on screen height to fill space
        // Header (~50) + Toggle (~50) + Calendar header (~50) + Weekday labels (~30) + Tab bar (~80) + Margins (~60) = ~320px
        // 6 rows max in a month - use smaller height to ensure all rows fit
        const CELL_HEIGHT = Math.floor((height - 320) / 6);

        return (
            <View style={styles.monthContainer}>
                <RNCalendar
                    current={selectedDate}
                    onDayPress={(day: DateData) => {
                        setSelectedDate(day.dateString);
                        setViewMode('week'); // Navigate to Week View
                    }}
                    hideExtraDays={false}
                    enableSwipeMonths={true}
                    theme={{
                        'stylesheet.calendar.header': {
                            header: {
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                paddingLeft: 10,
                                paddingRight: 10,
                                marginTop: 6,
                                alignItems: 'center'
                            }
                        }
                    } as any}
                    dayComponent={({ date, state }: { date?: any; state?: any }) => {
                        if (!date) return <View />; // Handle undefined date
                        const dateStr = date.dateString;
                        const dayEvents = getEventsForDate(dateStr);
                        const isSelected = dateStr === selectedDate;
                        const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                        const isCurrentMonth = state !== 'disabled';

                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    setSelectedDate(dateStr);
                                    setViewMode('week');
                                }}
                                style={[
                                    styles.dayCell,
                                    {
                                        height: CELL_HEIGHT,
                                        backgroundColor: isSelected
                                            ? theme.colors.primaryContainer
                                            : (isCurrentMonth ? theme.colors.surface : theme.colors.surfaceVariant),
                                        borderColor: isToday ? theme.colors.primary : theme.colors.outlineVariant,
                                        borderWidth: isToday ? 2 : 0.5,
                                        opacity: isCurrentMonth ? 1 : 0.4
                                    }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.dayNumber,
                                        {
                                            color: isSelected
                                                ? theme.colors.onPrimaryContainer
                                                : isToday
                                                    ? theme.colors.primary
                                                    : (state === 'disabled' ? theme.colors.outline : theme.colors.onSurface),
                                            fontWeight: isToday ? 'bold' : 'normal'
                                        }
                                    ]}
                                >
                                    {date.day}
                                </Text>

                                <View style={styles.dayEventsContainer}>
                                    {/* Medication Count */}
                                    {(() => {
                                        const medCount = new Set(dayEvents.filter((e: AppCalendarEvent) => e.type === 'medication').map((e: AppCalendarEvent) => e.medication_id || e.title)).size;
                                        const todoCount = new Set(dayEvents.filter((e: AppCalendarEvent) => e.type === 'todo').map((e: AppCalendarEvent) => e.todo_item_id || e.title)).size;

                                        return (
                                            <View style={{ flexDirection: 'column', gap: 2 }}>
                                                {medCount > 0 && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <MaterialCommunityIcons name="pill" size={10} color={theme.colors.primary} />
                                                        <Text style={{ fontSize: 9, color: theme.colors.primary }}>x {medCount}</Text>
                                                    </View>
                                                )}
                                                {todoCount > 0 && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={10} color={theme.colors.secondary} />
                                                        <Text style={{ fontSize: 9, color: theme.colors.secondary }}>x {todoCount}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })()}
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    style={styles.fullScreenCalendar}
                />
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
            {/* Edit Todo Dialog */}
            <Portal>
                <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
                    <Dialog.Title>Edit Task</Dialog.Title>
                    <Dialog.Content>
                        <View>
                            <TextInput
                                label="Title"
                                value={editTodoTitle}
                                onChangeText={setEditTodoTitle}
                                mode="outlined"
                                style={{ marginBottom: 12 }}
                            />
                            <TextInput
                                label="Frequency (days)"
                                value={editTodoFrequency}
                                onChangeText={setEditTodoFrequency}
                                mode="outlined"
                                keyboardType="numeric"
                                placeholder="e.g. 1 for daily"
                                style={{ marginBottom: 12 }}
                            />
                            <TextInput
                                label="Duration (days)"
                                value={editTodoDuration}
                                onChangeText={setEditTodoDuration}
                                mode="outlined"
                                keyboardType="numeric"
                                placeholder="e.g. 7"
                            />
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
                        <Button onPress={saveTodoEdit}>Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
    monthContainer: {
        flex: 1,
    },
    fullScreenCalendar: {
        width: width,
        // height is managed by content
    },
    dayCell: {
        width: (width - 16) / 7,
        borderRadius: 4,
        padding: 4,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    dayCellContent: {
        flex: 1,
        width: '100%',
    },
    dayNumber: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
        width: '100%',
    },
    dayEventsContainer: {
        flex: 1,
        gap: 1,
        width: '100%',
    },
    miniEventPill: {
        borderRadius: 2,
        paddingHorizontal: 2,
        paddingVertical: 1,
        justifyContent: 'center',
    },
    miniEventText: {
        fontSize: 8,
        lineHeight: 10,
        fontWeight: '500',
    },
    moreEventsText: {
        fontSize: 8,
        fontWeight: '500',
        marginLeft: 2,
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
