import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import SignInScreen from './sign-in';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * Sign-in must never be silent.
 *
 * The bug: the button was `disabled` until both fields had content, so tapping
 * it did literally nothing. The only signal was a 50% opacity change, which
 * users correctly read as a broken app. Reported as "when i click on sign in
 * nothing happens".
 *
 * One test, one network-free path: the validation happens before any request,
 * so this needs no fetch mock and no async settling.
 */
describe('SignInScreen validation', () => {
  it('explains which field is missing instead of ignoring the tap', async () => {
    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );

    const button = screen.getByLabelText('Sign in');

    // Reachable: no longer disabled on an incomplete form.
    expect(button.props.accessibilityState?.disabled).toBeFalsy();

    // Empty form -> says what is missing.
    fireEvent.press(button);
    await waitFor(() => expect(screen.getByText('Enter your email address.')).toBeTruthy());

    // Email only -> asks for the password. Wait for the field to settle first:
    // pressing in the same tick leaves onSubmit reading the pre-update value.
    fireEvent.changeText(screen.getByLabelText('Email'), 'demo@careerpilot.com');
    await waitFor(() =>
      expect(screen.getByLabelText('Email').props.value).toBe('demo@careerpilot.com'),
    );
    fireEvent.press(button);
    await waitFor(() => expect(screen.getByText('Enter your password.')).toBeTruthy());

    // Whitespace counts as empty, not as content: the message must still say
    // the password is missing, and the payload must never carry "    ".
    fireEvent.changeText(screen.getByLabelText('Password'), '    ');
    await waitFor(() =>
      expect(screen.getByLabelText('Password').props.value).toBe('    '),
    );
    fireEvent.press(button);
    await waitFor(() => expect(screen.getByText('Enter your password.')).toBeTruthy());

    // Typing clears the stale message rather than leaving it on screen.
    fireEvent.changeText(screen.getByLabelText('Password'), 'demo1234');
    await waitFor(() =>
      expect(screen.getByLabelText('Password').props.value).toBe('demo1234'),
    );
    await waitFor(() =>
      expect(screen.queryByText('Enter your password.')).toBeNull(),
    );
  });
});
