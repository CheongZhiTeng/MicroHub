import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Field, Notice, PasswordField } from '../src/components/ui';
test('busy action cannot be submitted twice', async () => {
  const submit = jest.fn();
  await render(<Button title="Apply" busy onPress={submit} />);
  await fireEvent.press(screen.getByRole('button'));
  expect(submit).not.toHaveBeenCalled();
});
test('available action works and has an accessible label', async () => {
  const submit = jest.fn();
  await render(<Button title="Apply" onPress={submit} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Apply' }));
  expect(submit).toHaveBeenCalledTimes(1);
});
test('input is labelled and errors are announced', async () => {
  await render(
    <>
      <Field label="School email" />
      <Notice error text="Email is invalid" />
    </>,
  );
  expect(screen.getByLabelText('School email')).toBeTruthy();
  expect(screen.getByRole('alert')).toBeTruthy();
});

test('password eye keeps the value and toggles masking; busy fields cannot be revealed', async () => {
  const change = jest.fn();
  const view = await render(
    <PasswordField label="Password" value="Example123" onChangeText={change} />,
  );
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  expect(screen.getByLabelText('Password').props.value).toBe('Example123');
  await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  await view.rerender(
    <PasswordField
      label="Password"
      value="Example123"
      onChangeText={change}
      editable={false}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  expect(change).not.toHaveBeenCalled();
});
