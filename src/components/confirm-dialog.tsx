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
    const timer = setTimeout(() => buttons()[0]?.focus(), 50);
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onCancel();
      }
      if (e.key === 'Tab') {
        const items = buttons();
        const index = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[
          (index + (e.shiftKey ? -1 : 1) + items.length) % items.length
        ]?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [visible, onCancel, busy]);
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
