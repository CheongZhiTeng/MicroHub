import { useEffect, useRef } from 'react';
import { Modal, Platform, View } from 'react-native';
import { Reveal } from './motion';
import { Button, Card, Heading, Body } from './ui';
export function ConfirmDialog({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  busy = false,
}: {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const root = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const previous = document.activeElement as HTMLElement | null;
    const container = () => root.current as unknown as HTMLElement | null;
    const buttons = () =>
      Array.from(
        container()?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [role="button"][tabindex="0"]',
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
      <View
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
          style={{ width: '100%', maxWidth: 420 }}
        >
          <Reveal key={visible ? 'open' : 'closed'}>
            <Card>
              <Heading>{title}</Heading>
              <Body>{message}</Body>
              <Button
                title="Cancel"
                variant="ghost"
                busy={busy}
                onPress={onCancel}
              />
              <Button
                title="Confirm"
                variant="danger"
                busy={busy}
                onPress={onConfirm}
              />
            </Card>
          </Reveal>
        </View>
      </View>
    </Modal>
  );
}
