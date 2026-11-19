import { View, Text } from 'react-native';
import { useTheme, type ThemeMode } from '../theme/provider';
import { MotionPressable } from './motion';
export function ThemePicker() {
  const { theme, mode, setMode } = useTheme();
  return (
    <View
      accessibilityLabel="Appearance"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        padding: 4,
        borderRadius: 14,
        backgroundColor: theme.color.background,
      }}
    >
      {(['system', 'light', 'dark'] as ThemeMode[]).map((value) => (
        <MotionPressable
          key={value}
          accessibilityRole="radio"
          accessibilityLabel={`${value} appearance`}
          accessibilityState={{ checked: mode === value }}
          aria-checked={mode === value}
          onPress={() => setMode(value)}
          style={{
            paddingHorizontal: 12,
            minHeight: 44,
            justifyContent: 'center',
            borderRadius: 10,
            backgroundColor:
              mode === value ? theme.color.selected : 'transparent',
          }}
        >
          <Text
            style={{
              fontFamily: theme.font,
              color: theme.color.text,
              fontWeight: mode === value ? '700' : '400',
              fontSize: 13,
            }}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Text>
        </MotionPressable>
      ))}
    </View>
  );
}
