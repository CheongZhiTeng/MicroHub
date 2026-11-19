import { useLanguage } from '../locales/provider';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/provider';
import { MotionPressable } from './motion';
export function ThemePicker() {
  const { t, language } = useLanguage();
  const { theme, mode, setMode } = useTheme();
  return (
    <View
      accessibilityLabel={t('Appearance')}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        padding: 4,
        borderRadius: 14,
        backgroundColor: theme.color.background,
      }}
    >
      {(
        [
          ['system', 'System'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ] as const
      ).map(([value, label]) => (
        <MotionPressable
          key={value}
          accessibilityRole="radio"
          accessibilityLabel={
            language === 'zh' ? t(label) : `${value} appearance`
          }
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
            {t(label)}
          </Text>
        </MotionPressable>
      ))}
    </View>
  );
}
