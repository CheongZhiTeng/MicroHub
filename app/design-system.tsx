import { useLanguage } from '../src/locales/provider';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  Screen,
  Card,
  Heading,
  Body,
  Button,
  Field,
  PasswordField,
  Badge,
  Notice,
  Loading,
} from '../src/components/ui';
import { ThemePicker } from '../src/components/theme-picker';
import { ConfirmDialog } from '../src/components/confirm-dialog';
export default function DesignSystem() {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen title={t('Component studio')} subtitle={t('Development preview')}>
      <ThemePicker />
      <Card>
        <Heading>{t('Actions & feedback')}</Heading>
        <Body>{t('Reusable building blocks for MicroHub.')}</Body>
        <Button title={t('Primary action')} onPress={() => setOpen(true)} />
        <Button
          title={t('Secondary action')}
          variant="secondary"
          onPress={() => setOpen(true)}
        />
        <Button
          title={t('Quiet action')}
          variant="ghost"
          onPress={() => setOpen(true)}
        />
        <Button title={t('Unavailable')} disabled onPress={() => {}} />
        <Button title={t('Saving')} busy onPress={() => {}} />
        <Badge label={t('In review')} />
        <Notice text={t('Changes saved')} />
        <Notice text={t('Please check your input')} error />
        <Loading />
      </Card>
      <Card>
        <Field label={t('Name')} value={value} onChangeText={setValue} />
        <PasswordField
          label={t('Password')}
          value={value}
          onChangeText={setValue}
          creating
        />
      </Card>
      <ConfirmDialog
        visible={open}
        title={t('Example confirmation')}
        message={t('This preview changes no account data.')}
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </Screen>
  );
}
