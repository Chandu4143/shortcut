import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export function BrandMark({ size = 26, color = colors.coral }: { size?: number; color?: string }) {
  const barWidth = size * 0.18;
  const gap = size * 0.075;
  return (
    <View style={[styles.mark, { width: size, height: size, gap }]}>
      <View style={{ width: barWidth, height: size * 0.42, backgroundColor: color, borderRadius: barWidth }} />
      <View style={{ width: barWidth, height: size * 0.68, backgroundColor: color, borderRadius: barWidth }} />
      <View style={{ width: barWidth, height: size * 0.94, backgroundColor: color, borderRadius: barWidth }} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    transform: [{ rotate: '-15deg' }],
  },
});
