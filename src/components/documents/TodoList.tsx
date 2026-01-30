import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TodoItem } from '../../types/database';
import { tokens } from '../../theme';

interface Props {
    todos: TodoItem[];
}

export function TodoList({ todos }: Props) {
    const theme = useTheme();

    if (!todos || todos.length === 0) return null;

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return theme.colors.error;
            case 'high': return theme.colors.warning;
            case 'medium': return theme.colors.primary;
            default: return theme.colors.onSurfaceVariant;
        }
    };

    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                Action Items ({todos.length})
            </Text>
            {todos.map((todo) => (
                <Card key={todo.id} style={styles.itemCard} mode="outlined">
                    <Card.Content style={styles.itemContent}>
                        <View style={styles.checkboxContainer}>
                            <Checkbox status={todo.completed ? 'checked' : 'unchecked'} />
                        </View>
                        <View style={styles.itemInfo}>
                            <Text 
                                variant="bodyLarge" 
                                style={{ 
                                    color: theme.colors.onSurface, 
                                    fontWeight: '600',
                                    textDecorationLine: todo.completed ? 'line-through' : 'none',
                                    opacity: todo.completed ? 0.6 : 1
                                }}
                            >
                                {todo.title}
                            </Text>
                            
                            {todo.description && (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                                    {todo.description}
                                </Text>
                            )}
                            
                            <View style={styles.detailsRow}>
                                {todo.priority && (
                                    <View style={[
                                        styles.badge, 
                                        { borderColor: getPriorityColor(todo.priority), borderWidth: 1 }
                                    ]}>
                                        <Text variant="labelSmall" style={{ color: getPriorityColor(todo.priority) }}>
                                            {todo.priority.toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                {todo.due_date && (
                                    <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <MaterialCommunityIcons name="calendar" size={12} color={theme.colors.onSurfaceVariant} style={{ marginRight: 4 }} />
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {new Date(todo.due_date).toLocaleDateString()}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Card.Content>
                </Card>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginBottom: tokens.spacing.lg },
    sectionTitle: { fontWeight: '600', marginBottom: tokens.spacing.md },
    itemCard: { marginBottom: tokens.spacing.sm, borderRadius: tokens.radius.md },
    itemContent: { flexDirection: 'row', alignItems: 'flex-start' },
    checkboxContainer: { marginRight: tokens.spacing.xs, marginLeft: -8, marginTop: -8 },
    itemInfo: { flex: 1, paddingTop: 4 },
    detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs, marginTop: tokens.spacing.sm },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});

