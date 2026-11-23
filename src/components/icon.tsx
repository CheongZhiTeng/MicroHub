import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/provider';

const paths = {
  chat: 'M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 1 1 17-5ZM8 10h8m-8 4h5',
  send: 'm3 4 18 8-18 8 3-8-3-8Zm3 8h15',
  edit: 'm14 5 5 5M4 20l4-1 13-13-4-4L4 15Z',
  code: 'm8 5-7 7 7 7m8-14 7 7-7 7m-3-17-2 20',
  home: 'm3 10 9-8 9 8v11h-6v-7H9v7H3Z',
  homework: 'M9 4H5v18h14V4h-4M9 2h6v5H9ZM8 11h8m-8 4h8m-8 4h5',
  attendance: 'M7 2v4m10-4v4M3 9h18M3 4h18v18H3Zm4 11 3 3 7-7',
  calendar: 'M7 2v4m10-4v4M3 9h18M3 4h18v18H3Zm4 9h2m4 0h2m-8 4h2m4 0h2',
  members:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3m1-17a4 4 0 0 1 0 7m2 3a4 4 0 0 1 3 4v3',
  more: 'M4 12h.01M12 12h.01M20 12h.01',
  bell: 'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M9 21h6',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-9 10v-2a7 7 0 0 1 7-6h4a7 7 0 0 1 7 6v2',
  announcement: 'M3 9v6h5l12 6V3L8 9Zm5 6 2 7H6l-2-7m4-6v6',
  chevron: 'm9 5 7 7-7 7',
  back: 'm15 5-7 7 7 7',
  check: 'm4 12 5 5L20 6',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-4.5 0a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z',
  clock: 'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0ZM12 6v6l4 2',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-5 9 4 4 6-6',
  book: 'M12 5C8 2 4 2 2 3v17c4-1 7 0 10 2m0-17c4-3 8-3 10-2v17c-4-1-7 0-10 2Z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-3-4 2-5-4 2-4-3-3 2-5 4 1Z',
  logout: 'M9 3H3v18h6m6-14 5 5-5 5m-8-5h13',
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Zm14 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  eyeOff:
    'm3 3 18 18M9 5c1-.3 2-.4 3-.4 7 0 11 7.4 11 7.4s-1 2-3 4M6 6c-3 2-5 6-5 6s4 7 11 7c2 0 4-.6 5-1.3',
  info: 'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0ZM12 11v6m0-10v.01',
  search: 'M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0Zm-2 5 7 7',
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 24,
  color,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  const { theme } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={true}
    >
      <Path
        d={paths[name]}
        stroke={color ?? theme.color.primary}
        strokeWidth={name === 'more' ? 4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
