import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import SignInScreen from './sign-in';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * The payload the sign-in screen actually sends.
 *
 * The regression was diagnosed against production:
 *
 *   {"email":"demo@careerpilot.com","password":"demo1234 "}  -> 401
 *   {"email":"demo@careerpilot.com","password":"demo1234"}   -> 200
 *
 * The server trims the email but compares the password byte for byte against a
 * bcrypt hash. Mobile keyboards add trailing spaces routinely through
 * autocomplete and swipe, so correct credentials were rejected with
 * "Email or password is incorrect." and no hint why.
 *
 * SCOPE: this asserts the OUTGOING payload only. What an incomplete form says
 * is in sign-in.validation.test.tsx, and what a server failure says is in
 * src/api/errorMessage.test.ts. Splitting it this way is deliberate — driving
 * several network submits through one file leaves the renderer unable to
 * produce output, so tests pass or fail by ordering rather than by behaviour.
 */
describe('SignInScreen payload', () => {
  const realFetch = global.fetch;
  let sent: Record<string, unknown> | null = null;

  beforeEach(() => {
    sent = null;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/auth/mobile/token')) {
        sent = init?.body ? JSON.parse(String(init.body)) : null;
      }
      return new Response(JSON.stringify({ message: 'Email or password is incorrect.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('trims whitespace from both fields before sending', async () => {
    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );

    fireEvent.changeText(screen.getByLabelText('Email'), '  demo@careerpilot.com  ');
    await waitFor(() =>
      expect(screen.getByLabelText('Email').props.value).toBe('  demo@careerpilot.com  '),
    );
    // A trailing space, exactly as a keyboard adds it.
    fireEvent.changeText(screen.getByLabelText('Password'), 'demo1234 ');
    await waitFor(() =>
      expect(screen.getByLabelText('Password').props.value).toBe('demo1234 '),
    );

    fireEvent.press(screen.getByLabelText('Sign in'));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toEqual({ email: 'demo@careerpilot.com', password: 'demo1234' });
  });
});
