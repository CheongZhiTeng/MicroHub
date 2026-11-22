import { useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { ConfirmDialog } from '../components/confirm-dialog';
import { useLanguage } from '../locales/provider';

export function useFormExit(dirty: boolean) {
  const { t } = useLanguage();
  const [finished, setFinished] = useState(false);
  const [resume, setResume] = useState<(() => void) | null>(null);
  const disable = usePreventRemove(dirty && !finished, ({ repeat }) =>
    setResume(() => repeat),
  );
  function finish() {
    setFinished(true);
    disable();
  }
  const dialog = (
    <ConfirmDialog
      visible={!!resume}
      title={t('Discard changes?')}
      confirmTitle={t('Discard changes')}
      cancelTitle={t('Keep editing')}
      message={t('Your unsaved changes will be lost.')}
      onCancel={() => setResume(null)}
      onConfirm={() => {
        setFinished(true);
        setResume(null);
        resume?.();
      }}
    />
  );
  return { finish, dialog };
}
