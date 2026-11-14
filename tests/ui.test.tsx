import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Field, Notice } from '../src/components/ui';
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
