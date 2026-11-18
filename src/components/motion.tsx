import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

// Conservative until the OS preference resolves. No looping/background animations.
const MotionContext = createContext(true);
export function MotionProvider({ children }: PropsWithChildren) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.matchMedia
    ) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(media.matches);
      update();
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    let current = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        changed = true;
        setReduced(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (current && !changed) setReduced(value);
      })
      .catch(() => {});
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return (
    <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>
  );
}
export const useReducedMotion = () => useContext(MotionContext);
export function Reveal({
  children,
  style,
  delay = 0,
  testID,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  delay?: number;
  testID?: string;
}>) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(1);
    };
  }, [delay, reduced, progress]);
  return (
    <Animated.View
      testID={testID}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...props
}: PressableProps) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    animation.current?.stop();
    scale.setValue(1);
    return () => animation.current?.stop();
  }, [reduced, props.disabled, scale]);
  const move = (toValue: number) => {
    animation.current?.stop();
    if (reduced || props.disabled) {
      scale.setValue(1);
      return;
    }
    animation.current = Animated.timing(scale, {
      toValue,
      duration: toValue === 1 ? 160 : 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.current.start();
  };
  return (
    <AnimatedPressable
      {...props}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      onPressIn={(event) => {
        setPressed(true);
        move(0.975);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        move(1);
        onPressOut?.(event);
      }}
      style={[
        typeof style === 'function'
          ? style({ pressed: pressed && !props.disabled, hovered })
          : style,
        { transform: [{ scale }] },
      ]}
    />
  );
}
