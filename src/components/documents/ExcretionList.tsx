import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BodilyExcretion } from '../../types/database';
import { tokens } from '../../theme';

interface Props {
    excretions: BodilyExcretion[];
}

export function ExcretionList({ excretions }: Props) {
    const theme = useTheme();

    if (!excretions || excretions.length === 0) return null;

    const getIconName = (type: string) => {
        switch (type) {
            case 'blood': return 'water';
            case 'urine': return 'water-outline';
            case 'stool': return 'emoticon-poop';
            case 'vomit': return 'emoticon-sick-outline';
            default: return 'alert-circle-outline';
        }
    };

    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                Bodily Excretions ({excretions.length})
            </Text>
            {excretions.map((excretion) => (
                <Card key={excretion.id} style={styles.itemCard} mode="outlined">
                    <Card.Content style={styles.itemContent}>
                        <View style={[styles.itemIcon, { backgroundColor: theme.colors.tertiaryContainer }]}>
                            <MaterialCommunityIcons 
                                name={getIconName(excretion.excretion_type) as any} 
                                size={24} 
                                color={theme.colors.tertiary} 
                            />
                        </View>
                        <View style={styles.itemInfo}>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                {excretion.excretion_type.charAt(0).toUpperCase() + excretion.excretion_type.slice(1)}
                            </Text>
                            
                            <View style={styles.detailsRow}>
                                {excretion.color && (
                                    <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            Color: {excretion.color}
                                        </Text>
                                    </View>
                                )}
                                {excretion.consistency && (
                                    <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {excretion.consistency}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {excretion.abnormality_indicators && excretion.abnormality_indicators.length > 0 && (
                                <View style={styles.tagsRow}>
                                    {excretion.abnormality_indicators.map((indicator, index) => (
                                        <Text key={index} variant="labelSmall" style={{ color: theme.colors.error }}>
                                            • {indicator.replace('_', ' ')}
                                        </Text>
                                    ))}
                                </View>
                            )}

                            {excretion.blood_present && (
                                <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 4, fontWeight: 'bold' }}>
                                    ⚠️ Blood Present
                                </Text>
                            )}
                            
                            {excretion.notes && (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, fontStyle: 'italic' }}>
                                    "{excretion.notes}"
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
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginTop: tokens.spacing.xs },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});

