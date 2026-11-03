import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../theme';

export function Sheet({
  children,
  style,
  dark = false,
  showHandle = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  showHandle?: boolean;
}) {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 4,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.sheet,
        dark && styles.sheetDark,
        shadow.lifted,
        style,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {showHandle ? <View style={[styles.handle, dark && styles.handleDark]} /> : null}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetDark: {
    backgroundColor: colors.navInk,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(23,43,40,0.16)',
    marginBottom: 12,
  },
  handleDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
