import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BodyCondition } from '../../types/database';
import { tokens } from '../../theme';

interface Props {
    conditions: BodyCondition[];
}

export function BodyConditionList({ conditions }: Props) {
    const theme = useTheme();

    if (!conditions || conditions.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                Body Conditions ({conditions.length})
            </Text>
            {conditions.map((condition) => (
                <Card key={condition.id} style={styles.itemCard} mode="outlined">
                    <Card.Content style={styles.itemContent}>
                        <View style={[styles.itemIcon, { backgroundColor: theme.colors.errorContainer }]}>
                            <MaterialCommunityIcons name="alert-circle" size={24} color={theme.colors.error} />
                        </View>
                        <View style={styles.itemInfo}>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                {condition.condition_type || 'Condition'} - {condition.body_location}
                            </Text>
                            {condition.location_description && (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {condition.location_description}
                                </Text>
                            )}
                            
                            <View style={styles.detailsRow}>
                                {condition.severity && (
                                    <View style={[styles.badge, { backgroundColor: theme.colors.errorContainer }]}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                                            {condition.severity.toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                {(condition.width_mm || condition.height_mm) && (
                                    <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>
                                            {condition.width_mm || '?'}x{condition.height_mm || '?'} mm
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {(condition.color || condition.texture || condition.shape) && (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                                    {[condition.color, condition.texture, condition.shape].filter(Boolean).join(', ')}
                                </Text>
                            )}
                            
                            {condition.notes && (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, fontStyle: 'italic' }}>
                                    "{condition.notes}"
                                </Text>
                            )}
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
    itemContent: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.md },
    itemIcon: { width: 44, height: 44, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center' },
    itemInfo: { flex: 1 },
    detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs, marginTop: tokens.spacing.xs },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});

