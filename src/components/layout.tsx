import { Children, type PropsWithChildren } from 'react';
import { View, useWindowDimensions } from 'react-native';
export function ContentGrid({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
      {Children.toArray(children).map((child, index) => (
        <View
          key={index}
          style={{
            width: width >= 640 ? '48%' : '100%',
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
