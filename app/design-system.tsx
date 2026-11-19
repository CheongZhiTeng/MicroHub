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
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen title="Component studio" subtitle="Development preview">
      <ThemePicker />
      <Card>
        <Heading>Actions & feedback</Heading>
        <Body>Reusable building blocks for MicroHub.</Body>
        <Button title="Primary action" onPress={() => setOpen(true)} />
        <Button
          title="Secondary action"
          variant="secondary"
          onPress={() => setOpen(true)}
        />
        <Button
          title="Quiet action"
          variant="ghost"
          onPress={() => setOpen(true)}
        />
        <Button title="Unavailable" disabled onPress={() => {}} />
        <Button title="Saving" busy onPress={() => {}} />
        <Badge label="In review" />
        <Notice text="Changes saved" />
        <Notice text="Please check your input" error />
        <Loading />
      </Card>
      <Card>
        <Field label="Name" value={value} onChangeText={setValue} />
        <PasswordField
          label="Password"
          value={value}
          onChangeText={setValue}
          creating
        />
      </Card>
      <ConfirmDialog
        visible={open}
        title="Example confirmation"
        message="This preview changes no account data."
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </Screen>
  );
}
