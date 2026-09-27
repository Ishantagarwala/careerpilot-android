import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import FirstRunScreen from './first-run';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * First-run screen render tests.
 *
 * Its whole job is to set expectations honestly, so these assert the copy
 * rather than the layout: permissions must be described as refusable, and the
 * offline story must not promise more than the app delivers.
 */
describe('FirstRunScreen', () => {
  it('renders both optional permissions', async () => {
    await render(
      <AllProviders>
        <FirstRunScreen />
      </AllProviders>,
    );
    expect(screen.getByText('Microphone')).toBeTruthy();
    expect(screen.getByText('Biometric unlock')).toBeTruthy();
  });

  it('says plainly that neither permission is required', async () => {
    // Requesting permissions the user has not been prepared for is how you earn
    // a permanent denial. The copy has to carry that.
    await render(
      <AllProviders>
        <FirstRunScreen />
      </AllProviders>,
    );
    expect(screen.getByText(/Both are optional/i)).toBeTruthy();
  });

  it('describes biometric unlock as a choice made at sign-in, not here', async () => {
    // The screen previously implied the decision was made here, which was
    // untrue: the offer lives on the sign-in screen where the password exists.
    await render(
      <AllProviders>
        <FirstRunScreen />
      </AllProviders>,
    );
    expect(screen.getByText(/choose whether to turn this on when you sign in/i)).toBeTruthy();
  });

  it('explains offline support and both ways forward', async () => {
    await render(
      <AllProviders>
        <FirstRunScreen />
      </AllProviders>,
    );
    expect(screen.getByText('Works offline')).toBeTruthy();
    expect(screen.getByLabelText('Continue')).toBeTruthy();
    expect(screen.getByLabelText('Skip setup')).toBeTruthy();
  });
});
