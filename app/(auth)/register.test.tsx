import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import RegisterScreen from './register';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * Register screen tests.
 *
 * SCOPE NOTE: the behaviour that actually broke — a server message being
 * replaced by "Request failed (400)" — is verified in
 * src/api/errorMessage.test.ts, where the function is pure and every response
 * shape can be covered.
 *
 * It lives there rather than here on purpose. Driving the full submit flow
 * through this screen proved unreliable: the press that triggers the request
 * left the renderer in a state where every later render in the file produced
 * nothing, so tests passed alone and failed together. Asserting on the pure
 * function is both stronger and honest about what is covered where.
 */

describe('RegisterScreen', () => {
  it('states up front that sign-up cannot work in the app yet', async () => {
    // The server requires hCaptcha for registration and a native app cannot
    // solve it. A form that lets you fill it in and then fails is worse than
    // one that says so before you start.
    await render(
      <AllProviders>
        <RegisterScreen />
      </AllProviders>,
    );
    expect(screen.getByText(/Sign-up is not available in the app yet/i)).toBeTruthy();
    expect(screen.getByText(/Create your account on careerpilot.cc/i)).toBeTruthy();
  });

  it('explains an incomplete form rather than ignoring the tap', async () => {
    // The button used to be `disabled` until every field was valid, so tapping
    // it did nothing and the only signal was a dimmed colour. It now responds
    // and says which field is wrong.
    await render(
      <AllProviders>
        <RegisterScreen />
      </AllProviders>,
    );
    const button = screen.getByLabelText('Create account');
    expect(button.props.accessibilityState?.disabled).toBeFalsy();

    fireEvent.press(button);
    await waitFor(() => expect(screen.getByText('Enter your name.')).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText('Name'), 'Sujoy');
    await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Sujoy'));
    fireEvent.press(screen.getByLabelText('Create account'));
    await waitFor(() => expect(screen.getByText('Enter your email address.')).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText('Email'), 'a@gmail.com');
    await waitFor(() => expect(screen.getByLabelText('Email').props.value).toBe('a@gmail.com'));
    fireEvent.changeText(screen.getByLabelText('Password'), '1234567');
    await waitFor(() => expect(screen.getByLabelText('Password').props.value).toBe('1234567'));
    fireEvent.press(screen.getByLabelText('Create account'));
    await waitFor(() =>
      expect(screen.getByText('Use a password of at least 8 characters.')).toBeTruthy(),
    );
  });
});
