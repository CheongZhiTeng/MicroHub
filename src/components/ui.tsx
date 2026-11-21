import { useLanguage } from '../locales/provider';
import { passwordChecks } from '../lib/validation';
import { useRef, useState, type PropsWithChildren, type Ref } from 'react';
import {
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Theme } from '../theme/tokens';
import { useTheme } from '../theme/provider';
import { Icon, type IconName } from './icon';
import { MotionPressable, Reveal } from './motion';
import { ThemePicker } from './theme-picker';
import { Campus } from './illustrations/campus';

export type InputHandle = React.ComponentRef<typeof TextInput>;

export function Brand({ subtitle }: { subtitle?: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { t } = useLanguage();
  return (
    <View style={styles.brandRow}>
      <View style={styles.logo}>
        <Icon name="code" size={30} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.brand}>MicroHub</Text>
        <Text style={styles.brandSubtitle}>
          {subtitle ?? t('Your school club, connected.')}
        </Text>
      </View>
    </View>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  auth = false,
  header,
  dashboard = false,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  auth?: boolean;
  header?: React.ReactNode;
  dashboard?: boolean;
}>) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingHorizontal: width < 640 ? 20 : 32 },
          ]}
        >
          <Reveal
            testID="screen-content"
            style={{
              width: '100%',
              maxWidth: 1440,
              alignSelf: 'center',
              gap: 28,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <View style={{ flex: 1 }}>{header ?? <Brand />}</View>
              <LanguageToggle />
              {auth && desktop && <ThemePicker />}
            </View>
            <View
              style={{
                flexDirection: auth && desktop ? 'row' : 'column',
                gap: desktop ? 48 : 24,
                alignItems: auth && desktop ? 'center' : undefined,
                paddingVertical: auth && desktop ? 60 : 0,
              }}
            >
              <View
                style={[
                  styles.intro,
                  (auth || dashboard) && styles.hero,
                  auth && desktop && { flex: 1, minHeight: 360, padding: 36 },
                ]}
              >
                <View style={styles.heroCopy}>
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.title,
                      desktop && { fontSize: 38, lineHeight: 46 },
                    ]}
                  >
                    {title}
                  </Text>
                  {Boolean(subtitle) && (
                    <Text style={styles.body}>{subtitle}</Text>
                  )}
                </View>
                {(auth || dashboard) && (
                  <View pointerEvents="none" style={styles.campus}>
                    <Campus width={112} height={100} />
                  </View>
                )}
              </View>
              <View
                style={[
                  { gap: 20, minWidth: 0 },
                  auth && { width: '100%', maxWidth: 440, alignSelf: 'center' },
                  auth && desktop && { flex: 1 },
                ]}
              >
                {children}
                {auth && (
                  <View style={styles.privacy}>
                    <Icon name="shield" size={16} />
                    <Text style={styles.caption}>
                      {t(
                        'Private club · Verified school accounts                    ',
                      )}
                    </Text>
                  </View>
                )}
                {auth && !desktop && <ThemePicker />}
              </View>
            </View>
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <Button
      title={language === 'en' ? '中文' : 'English'}
      accessibilityLabel={
        language === 'en' ? '切换至简体中文' : 'Switch to English'
      }
      variant="secondary"
      onPress={() => setLanguage(language === 'en' ? 'zh' : 'en')}
    />
  );
}
export function Card({
  children,
  style,
  delay = 0,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; delay?: number }>) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Reveal testID="motion-card" delay={delay} style={[styles.card, style]}>
      {children}
    </Reveal>
  );
}
export function Body({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return <Text style={styles.body}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function SectionTitle({
  children,
  icon,
}: PropsWithChildren<{ icon: IconName }>) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.sectionTitle}>
      <Icon name={icon} />
      <View style={styles.flex}>
        <Heading>{children}</Heading>
      </View>
    </View>
  );
}
export function Badge({ label }: { label: string }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.initials}>{initials || 'M'}</Text>
    </View>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Icon name={icon} color={theme.color.muted} />
    </MotionPressable>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Text
      accessibilityRole={error ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.notice, error && styles.error]}
    >
      {t(text)}
    </Text>
  );
}
export function Loading() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.loading, { gap: 12 }]}>
      <ActivityIndicator
        accessibilityLabel={t('Loading')}
        color={theme.color.primary}
        size="large"
      />
      {[100, 80, 60].map((width) => (
        <View
          key={width}
          accessible={false}
          style={{
            height: 12,
            width: `${width}%`,
            borderRadius: 6,
            backgroundColor: theme.color.border,
          }}
        />
      ))}
    </View>
  );
}
export function Button({
  title,
  accessibilityLabel = title,
  onPress,
  busy = false,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  icon,
}: {
  title: string;
  accessibilityLabel?: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: IconName;
}) {
  const { t } = useLanguage();
  const secondary = variant === 'secondary';
  const quiet = variant === 'ghost';
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.button,
        { alignSelf: fullWidth && !quiet ? 'stretch' : 'flex-start' },
        variant === 'danger' && { backgroundColor: theme.color.errorSurface },
        hovered &&
          !busy &&
          variant === 'primary' && { backgroundColor: theme.color.primaryDark },
        secondary && styles.secondary,
        quiet && styles.quiet,
        (pressed || busy || disabled) && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={
            variant === 'danger'
              ? theme.color.error
              : secondary || quiet
                ? theme.color.primary
                : theme.color.onPrimary
          }
          size="small"
        />
      ) : icon ? (
        <Icon
          name={icon}
          size={20}
          color={
            variant === 'danger'
              ? theme.color.error
              : secondary || quiet
                ? theme.color.primary
                : theme.color.onPrimary
          }
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          variant === 'danger' && { color: theme.color.error },
          secondary && { color: theme.color.text },
          quiet && { color: theme.color.primaryDark },
        ]}
      >
        {busy ? t('Please wait…') : title}
      </Text>
    </MotionPressable>
  );
}
export function NavigationRow({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
    >
      <View style={styles.iconTile}>
        <Icon name={icon} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.navTitle}>{title}</Text>
        {Boolean(subtitle) && <Text style={styles.caption}>{subtitle}</Text>}
      </View>
      <Icon name="chevron" size={18} color={theme.color.muted} />
    </MotionPressable>
  );
}
export function Field({
  label,
  style,
  inputRef,
  onFocus,
  onBlur,
  hint,
  error,
  ...props
}: TextInputProps & {
  label: string;
  inputRef?: Ref<InputHandle>;
  hint?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={theme.color.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          props.editable === false && styles.readOnly,
          focused && styles.focused,
          Boolean(error) && { borderColor: theme.color.error },
          style,
        ]}
      />
      {Boolean(error) && <Notice text={error!} error />}
      {Boolean(hint) && <Text style={styles.caption}>{hint}</Text>}
    </View>
  );
}
export function PasswordField({
  label,
  value,
  onChangeText,
  editable = true,
  creating = false,
  inputRef,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  creating?: boolean;
  inputRef?: React.RefObject<InputHandle | null>;
  onSubmitEditing?: () => void;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const ownRef = useRef<InputHandle>(null);
  const ref = inputRef ?? ownRef;
  const rules = passwordChecks(value);
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={creating ? 'new-password' : 'current-password'}
          returnKeyType="go"
          onSubmitEditing={editable ? onSubmitEditing : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            styles.passwordInput,
            !editable && styles.readOnly,
            focused && styles.focused,
          ]}
        />
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={visible ? t('Hide password') : t('Show password')}
          accessibilityState={{ disabled: !editable }}
          disabled={!editable}
          onPress={() => {
            setVisible(!visible);
            ref.current?.focus();
          }}
          style={[styles.passwordToggle, visible && styles.eyeActive]}
        >
          <Icon
            name={visible ? 'eyeOff' : 'eye'}
            size={21}
            color={visible ? theme.color.primary : theme.color.muted}
          />
        </MotionPressable>
      </View>
      {creating && (
        <View style={styles.rules}>
          {rules.map((rule) => (
            <View
              key={rule.label}
              style={[styles.rule, rule.met && styles.ruleMet]}
              accessibilityLabel={`${t(rule.label)}: ${rule.met ? t('met') : t('not met')}`}
            >
              <Icon
                name={rule.met ? 'check' : 'info'}
                size={12}
                color={rule.met ? theme.color.primaryDark : theme.color.muted}
              />
              <Text
                style={[
                  styles.ruleText,
                  rule.met && { color: theme.color.primaryDark },
                ]}
              >
                {t(rule.label)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
export function AuthSteps({ step }: { step: 1 | 2 }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View
      style={styles.steps}
      accessibilityLabel={`Step ${step} of 2: ${step === 1 ? t('Create account') : t('Verify email')}`}
    >
      {['Account', 'Verify email'].map((label, index) => (
        <View key={label} style={styles.step}>
          <View
            style={[styles.stepNumber, step >= index + 1 && styles.stepActive]}
          >
            {step > index + 1 ? (
              <Icon name="check" size={14} color={theme.color.onPrimary} />
            ) : (
              <Text
                style={[
                  styles.stepDigit,
                  step >= index + 1 && { color: theme.color.onPrimary },
                ]}
              >
                {index + 1}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.stepText,
              step === index + 1 && {
                color: theme.color.text,
                fontWeight: '700',
              },
            ]}
          >
            {label}
          </Text>
          {index === 0 && <View style={styles.stepLine} />}
        </View>
      ))}
    </View>
  );
}
const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background },
    scroll: {
      paddingHorizontal: 18,
      paddingTop: 24,
      paddingBottom: 40,
      flexGrow: 1,
    },
    content: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: 16 },
    authContent: { maxWidth: 520 },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    logo: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor: '#104E55',
      alignItems: 'center',
      justifyContent: 'center',
    },
    brand: {
      fontFamily: theme.font,
      fontSize: theme.type.brand,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: theme.color.text,
    },
    brandSubtitle: {
      fontFamily: theme.font,
      fontSize: 12,
      lineHeight: 17,
      color: theme.color.muted,
    },
    flex: { flex: 1, minWidth: 0 },
    intro: { gap: 8, paddingTop: 12 },
    hero: {
      backgroundColor: theme.color.subtle,
      borderRadius: 24,
      padding: 18,
      gap: 10,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
    },
    dashboardHero: { backgroundColor: theme.color.subtle },
    heroCopy: { flex: 1, minWidth: 0, gap: 8 },
    campus: { width: 96, alignItems: 'center', justifyContent: 'center' },
    title: {
      fontFamily: theme.font,
      fontSize: theme.type.title,
      lineHeight: 33,
      fontWeight: '800',
      letterSpacing: -0.7,
      color: theme.color.text,
    },
    heading: {
      fontFamily: theme.font,
      fontSize: theme.type.heading,
      lineHeight: 25,
      fontWeight: '700',
      letterSpacing: -0.35,
      color: theme.color.text,
    },
    body: {
      fontFamily: theme.font,
      fontSize: theme.type.body,
      lineHeight: 23,
      color: theme.color.muted,
    },
    caption: {
      fontFamily: theme.font,
      color: theme.color.muted,
      fontSize: 12,
      lineHeight: 19,
    },
    card: {
      backgroundColor: theme.color.surface,
      padding: 18,
      borderRadius: theme.radii.card,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.color.border,
      ...theme.shadow,
    },
    sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.color.subtle,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.radii.pill,
    },
    badgeText: {
      fontFamily: theme.font,
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.primaryDark,
    },
    avatar: {
      backgroundColor: theme.color.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontFamily: theme.font,
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.primaryDark,
    },
    iconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
    },
    notice: {
      fontFamily: theme.font,
      padding: 12,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.color.subtle,
      color: theme.color.primaryDark,
      fontSize: 14,
      lineHeight: 22,
    },
    error: {
      color: theme.color.error,
      backgroundColor: theme.color.errorSurface,
    },
    loading: { padding: 24 },
    button: {
      minHeight: 44,
      flexDirection: 'row',
      gap: 8,
      borderRadius: theme.radii.control,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: theme.color.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondary: {
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.border,
    },
    quiet: {
      backgroundColor: 'transparent',
      minHeight: 44,
      paddingVertical: 8,
    },
    pressed: { opacity: 0.65 },
    buttonText: {
      fontFamily: theme.font,
      flexShrink: 1,
      textAlign: 'center',
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
      color: theme.color.onPrimary,
    },
    field: { gap: 8 },
    label: {
      fontFamily: theme.font,
      color: theme.color.text,
      fontSize: 13,
      fontWeight: '600',
    },
    input: {
      fontFamily: theme.font,
      borderWidth: 1,
      borderColor: theme.color.border,
      borderRadius: theme.radii.control,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 50,
      color: theme.color.text,
      fontSize: 16,
      backgroundColor: theme.color.surface,
    },
    focused: {
      borderColor: theme.color.focus,
      backgroundColor: theme.color.subtle,
    },
    readOnly: { backgroundColor: theme.color.background },
    passwordWrap: { position: 'relative' },
    passwordInput: { paddingRight: 52 },
    passwordToggle: {
      position: 'absolute',
      right: 3,
      top: 3,
      bottom: 3,
      borderRadius: 9,
      width: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyeActive: { backgroundColor: theme.color.subtle },
    rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    rule: {
      flexDirection: 'row',
      gap: 4,
      alignItems: 'center',
      backgroundColor: theme.color.background,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 5,
    },
    ruleMet: { backgroundColor: theme.color.subtle },
    ruleText: {
      fontFamily: theme.font,
      fontSize: 12,
      color: theme.color.muted,
    },
    steps: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border,
      marginBottom: 4,
    },
    step: { flexDirection: 'row', gap: 7, alignItems: 'center', flex: 1 },
    stepNumber: {
      width: 25,
      height: 25,
      borderRadius: 9,
      backgroundColor: theme.color.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepActive: { backgroundColor: theme.color.primary },
    stepDigit: {
      fontFamily: theme.font,
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.muted,
    },
    stepText: {
      fontFamily: theme.font,
      fontSize: 12,
      color: theme.color.muted,
      flexShrink: 1,
    },
    stepLine: { height: 1, backgroundColor: theme.color.border, flex: 1 },
    privacy: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      paddingVertical: 8,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingVertical: 8,
    },
    navTitle: {
      fontFamily: theme.font,
      fontSize: 15,
      lineHeight: 23,
      fontWeight: '600',
      color: theme.color.text,
    },
    iconTile: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.color.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
