import { useLanguage } from '../locales/provider';
import { useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Reveal } from './motion';
import { Button, Card, Heading, Body } from './ui';
export function ConfirmDialog({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  busy = false,
  children,
  confirmTitle,
  cancelTitle,
  danger = true,
  disabled = false,
}: {
  visible: boolean;
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmTitle?: string;
  cancelTitle?: string;
  danger?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const { t } = useLanguage();
  const root = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const previous = document.activeElement as HTMLElement | null;
    const container = () => root.current as unknown as HTMLElement | null;
    const buttons = () =>
      Array.from(
        container()?.querySelectorAll<HTMLElement>(
          'input:not(:disabled),textarea:not(:disabled),button:not(:disabled), [role="button"][tabindex="0"]',
        ) ?? [],
      );
    const timer = requestAnimationFrame(() => {
      if (!container()?.contains(document.activeElement)) buttons()[0]?.focus();
    });
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const items = buttons();
        if (items.length === 0) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next =
          index < 0
            ? e.shiftKey
              ? items.length - 1
              : 0
            : (index + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        e.preventDefault();
        items[next]?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: '#00000088',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          ref={root}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{ width: '100%', maxWidth: 420, maxHeight: '100%' }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <Reveal key={visible ? 'open' : 'closed'}>
              <Card>
                <Heading>{title}</Heading>
                {message && <Body>{message}</Body>}
                {children}
                <Button
                  title={cancelTitle ?? t('Cancel')}
                  variant="ghost"
                  busy={busy}
                  onPress={onCancel}
                />
                <Button
                  title={confirmTitle ?? t('Confirm')}
                  disabled={disabled}
                  variant={danger ? 'danger' : 'primary'}
                  busy={busy}
                  onPress={onConfirm}
                />
              </Card>
            </Reveal>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
