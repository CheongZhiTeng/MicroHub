import { useState, type PropsWithChildren } from 'react';
import { PASSWORD_RULE } from '../lib/validation';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/tokens';
export function Screen({
  children,
  title,
  subtitle,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.content}>
            <Text style={styles.brand}>MICROHUB / CLUB SPACE</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {Boolean(subtitle) && <Text style={styles.body}>{subtitle}</Text>}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <Text
      accessibilityRole={error ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.notice, error && styles.error]}
    >
      {text}
    </Text>
  );
}
export function Loading() {
  return (
    <ActivityIndicator
      accessibilityLabel="Loading"
      color={theme.color.primary}
      size="large"
    />
  );
}
export function Button({
  title,
  onPress,
  busy = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || busy) && { opacity: 0.65 },
      ]}
    >
      <Text
        style={[styles.buttonText, secondary && { color: theme.color.primary }]}
      >
        {busy ? 'Please wait…' : title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.color.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}
export function PasswordField({
  label,
  value,
  onChangeText,
  editable = true,
  creating = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  creating?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Field
        label={label}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={creating ? 'new-password' : 'current-password'}
      />
      {creating && (
        <Body>
          {PASSWORD_RULE} {value.length} characters entered.
        </Body>
      )}
      <Button
        title={visible ? 'Hide password' : 'Show password'}
        secondary
        onPress={() => setVisible(!visible)}
      />
    </>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.background },
  scroll: { padding: 24, paddingBottom: 48, flexGrow: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 16 },
  brand: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    color: theme.color.primary,
  },
  title: { fontSize: 32, fontWeight: '700', color: theme.color.text },
  heading: { fontSize: 20, fontWeight: '600', color: theme.color.text },
  body: { fontSize: 16, lineHeight: 25, color: theme.color.muted },
  card: {
    backgroundColor: theme.color.surface,
    padding: 24,
    borderRadius: theme.radius,
    gap: 16,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  notice: { color: theme.color.primary, fontSize: 15, lineHeight: 23 },
  error: { color: theme.color.error },
  button: {
    minHeight: 50,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: theme.color.subtle },
  buttonText: { fontSize: 16, fontWeight: '600', color: theme.color.onPrimary },
  field: { gap: 8 },
  label: { color: theme.color.text, fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 10,
    padding: 14,
    minHeight: 50,
    color: theme.color.text,
    fontSize: 16,
    backgroundColor: theme.color.surface,
  },
});
