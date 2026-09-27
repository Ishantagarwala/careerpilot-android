import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import * as SecureStore from 'expo-secure-store';

import { AllProviders } from '@/test/AllProviders';
import MeScreen from './me';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * The in-memory SecureStore mock persists across tests in a file, so state
 * written by one test leaks into the next and silently changes what renders.
 */
function resetSecureStore(): void {
  (SecureStore as unknown as { __reset: () => void }).__reset();
}

/**
 * Me screen render tests.
 *
 * The important one is the sign-out control and the tracked-study-stats panel:
 * both previously said things that were not necessarily true ("Biometric unlock
 * is on", hard-coded zeros presented as real counts).
 */
describe('MeScreen', () => {
  it('renders the account section', async () => {
    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
  });

  it('offers all three theme modes and marks the active one', async () => {
    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );
    // Labels are lowercase — the screen builds them from the ThemeMode value.
    for (const label of ['light theme', 'dark theme', 'system theme']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    // The visible text uses the friendlier names.
    for (const text of ['Light', 'Dark', 'Auto']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it('switches theme mode when a mode is pressed', async () => {
    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );
    const dark = screen.getByLabelText('dark theme');
    expect(dark.props.accessibilityState?.selected).toBe(false);

    fireEvent.press(dark);
    await waitFor(() => {
      expect(screen.getByLabelText('dark theme').props.accessibilityState?.selected).toBe(true);
    });
  });

  it('reports the real biometric state rather than claiming it is on', async () => {
    // The previous copy said "Biometric unlock is on" unconditionally, which is
    // unknowable without asking the device. With nothing stored, the row must
    // describe the actual state instead.
    resetSecureStore();

    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/turn on at sign-in/i)).toBeTruthy();
    });
    expect(screen.queryByText(/unlock is on/i)).toBeNull();
  });

  it('offers to turn biometric unlock off once it is on', async () => {
    // The other half of the same honesty requirement: when something IS stored,
    // the row must say so and be actionable.
    resetSecureStore();
    await SecureStore.setItemAsync('careerpilot.biometric.email', 'a@b.com');
    await SecureStore.setItemAsync('careerpilot.biometric.password', 'secret');

    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/unlock is on/i)).toBeTruthy();
    });
  });

  it('warns that sign-in is restricted to residential connections', async () => {
    // A user who does not know this reads the server's refusal as a broken app.
    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );
    expect(screen.getByText(/residential IPs/i)).toBeTruthy();
  });

  it('exposes sign out', async () => {
    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );
    expect(screen.getByLabelText('Sign out')).toBeTruthy();
  });

  it('does not present placeholder stats as real data', async () => {
    // The tiles show an em dash until profile/progress are wired, rather than
    // a convincing-looking zero.
    await render(
      <AllProviders>
        <MeScreen />
      </AllProviders>,
    );
    expect(screen.getByText('DAY STREAK')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});
