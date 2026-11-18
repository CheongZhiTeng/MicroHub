import { Platform } from 'react-native';

// Modern Campus: values follow the supplied dashboard reference.
export const theme = {
  color: {
    background: '#F2F8F7',
    surface: '#FFFFFF',
    text: '#10132E',
    muted: '#535B66',
    primary: '#087F7A',
    primaryDark: '#104E55',
    border: '#DFE6E8',
    error: '#B12A3E',
    errorSurface: '#FFF0F2',
    subtle: '#DEF5EE',
    selected: '#BCEDE1',
    onPrimary: '#FFFFFF',
    lavender: '#EEE9FF',
    violet: '#66509A',
    peach: '#FFF0DE',
    amber: '#8A5518',
    sky: '#E4F1FF',
    blue: '#346CA1',
    focus: '#087F7A',
  },
  font: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui',
  }),
  type: { brand: 28, title: 26, heading: 18, body: 15, label: 13, caption: 12 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 10, control: 12, card: 18, pill: 999 },
  radius: 18,
  shadow: {
    shadowColor: '#163A40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
};
