import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

// Original vector artwork; decorative, scalable and bundled with the application.
export function Campus({
  width = 230,
  height = 136,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 300 180" aria-hidden={true}>
      <Path
        d="M10 166C-3 112 42 110 60 70S114 1 166 14s40 39 88 30 61 79 35 122Z"
        fill="#D9EFF1"
      />
      <Path d="M0 163c65-49 122-6 170-13s90-25 130-7v37H0Z" fill="#91C8A9" />
      <Path d="M0 173c60-9 104-21 147-14s104 5 153 0v21H0Z" fill="#56A58A" />
      <Path d="M92 160h176V81H92Z" fill="#F4E6C8" />
      <Path d="m82 82 18-19h161l18 19Z" fill="#468B91" />
      <Path d="M166 45h45v116h-45Z" fill="#FFFAEB" />
      <Path d="m157 46 31-27 32 27Z" fill="#347B84" />
      <Path d="M188 19V8" stroke="#4D797B" strokeWidth="2" />
      <Path d="M188 9h15l-5 5h-10Z" fill="#088981" />
      <Path d="M161 47h55v6h-55Z" fill="#D6CAA9" />
      <Circle
        cx="189"
        cy="69"
        r="12"
        fill="#FFF"
        stroke="#B7D6D6"
        strokeWidth="3"
      />
      <Path d="M189 60v10h6" stroke="#397E86" strokeWidth="2" fill="none" />
      {[102, 127, 228, 253].map((x) => (
        <G key={x}>
          <Rect x={x} y="94" width="11" height="17" fill="#75B1B5" />
          <Rect x={x} y="124" width="11" height="17" fill="#75B1B5" />
          <Path
            d={`M${x + 5.5} 94v17m-5.5-8h11m-5.5 21v17`}
            stroke="#FFFAEB"
            strokeWidth="1.5"
          />
        </G>
      ))}
      <Path d="M180 160v-40a9 9 0 0 1 18 0v40Z" fill="#317D81" />
      <Path d="M175 164h28m-32 5h36" stroke="#ECE5CF" strokeWidth="5" />
      <Path d="M189 170c-9 0-13 6-21 10h64l-33-10Z" fill="#E5EEE0" />
      {[
        { x: 42, y: 137, r: 19 },
        { x: 70, y: 147, r: 15 },
        { x: 144, y: 144, r: 13 },
        { x: 266, y: 139, r: 16 },
        { x: 288, y: 150, r: 13 },
      ].map(({ x, y, r }) => (
        <G key={x}>
          <Circle
            cx={x}
            cy={y - r}
            r={r}
            fill={x % 3 ? '#64A88A' : '#8AB66E'}
          />
          <Path
            d={`M${x} ${y - r}v${r + 19}m0-11 7-6`}
            stroke="#387B69"
            strokeWidth="3"
            fill="none"
          />
        </G>
      ))}
      <Path d="m66 120 12-42 12 42Zm161-17 10-42 10 42Z" fill="#5B9F8A" />
      <Path
        d="M44 54h34m-25-5h14M233 35h38m-27-5h14"
        stroke="#FFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
export function StudyArt() {
  return (
    <Svg width={112} height={84} viewBox="0 0 140 105" aria-hidden={true}>
      <Ellipse cx="75" cy="96" rx="63" ry="5" fill="#D7EBE5" />
      <Path
        d="M108 91c0-22 26-24 26-24s-1 24-26 24m-2-6c-5-18 12-34 12-34s10 20-12 34"
        fill="#75B9A0"
      />
      <Rect
        x="5"
        y="80"
        width="65"
        height="14"
        rx="4"
        fill="#FFF"
        stroke="#15988A"
        strokeWidth="3"
      />
      <Rect
        x="13"
        y="65"
        width="55"
        height="12"
        rx="3"
        fill="#D7EDE5"
        stroke="#4D9E85"
        strokeWidth="3"
      />
      <Path d="m53 13 74 2-14 75-78-2Z" fill="#53C0B2" />
      <Path d="m57 19 63 2-12 61-65-1Z" fill="#164E5A" />
      <Path
        d="m73 39-11 10 8 9m23-17 9 9-13 9m-5-24-9 28"
        stroke="#B7E8E4"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M35 88h78l-7 7H28Z" fill="#1D9289" />
    </Svg>
  );
}
