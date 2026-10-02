import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import SignInScreen from '../(auth)/sign-in';

/**
 * Sign-in screen render tests.
 *
 * This is the first screen every user sees, and until now it had never been
 * rendered by anything. It exercises three states that are easy to get wrong:
 * the biometric affordance when the device supports it, the device-check notice
 * from integrityStatus(), and the error box.
 */

// useFonts is not run here (the root layout owns it), so the screens render with
// whatever faces the test environment supplies. That is fine: these assert
// structure and behaviour, not type.

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

/**
 * The in-memory SecureStore mock persists across tests in a file, so a
 * credential written by one test leaks into the next and silently changes which
 * biometric state renders.
 */
function resetSecureStore(): void {
  (SecureStore as unknown as { __reset: () => void }).__reset();
}

describe('SignInScreen', () => {
  it('renders the brand headline and both fields', async () => {
    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );

    expect(screen.getByText('career goal')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('offers the create-account path', async () => {
    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );
    expect(screen.getByLabelText('Create an account')).toBeTruthy();
  });

  it('states which bot gate it will use instead of showing a fake checkbox', async () => {
    // The mockup shows an hCaptcha widget inline. Rendering a dead one would be
    // worse than not rendering it, so the notice states the gate instead: Play
    // Integrity when the build can attest, a captcha sheet otherwise. The sheet
    // opens on the server's refusal, not on mount.
    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );
    expect(screen.getByText('Before you sign in')).toBeTruthy();
    // Three possible reasons depending on config, and all of them name the gate:
    // no project configured / attestation switched off for a sideloaded build /
    // attestation enabled. Under Jest none of the EXPO_PUBLIC_* vars are set, so
    // this exercises the unconfigured wording.
    expect(screen.getByText(/Play Integrity|captcha/i)).toBeTruthy();
    // Not shown until the server asks for one.
    expect(screen.queryByText('Quick check')).toBeNull();
  });

  it('tells the user about the residential-IP restriction before they try', async () => {
    // The server refuses VPN and datacenter addresses. A user who does not know
    // that reads the rejection as a broken app.
    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );
    expect(screen.getByText(/residential connections/i)).toBeTruthy();
  });

  it('offers to REMEMBER the sign-in when nothing is stored yet', async () => {
    // The local-authentication mock reports FACIAL_RECOGNITION, and
    // src/auth/biometrics.ts checks face before fingerprint, so the rendered
    // label is "Face unlock". Matching the kind-agnostically keeps this test
    // about the STATE, not about which sensor the mock happens to name.
    //
    // The two biometric states are deliberately different and easy to confuse:
    //   nothing stored  -> offer to remember (the user must sign in once)
    //   something stored -> offer one-tap sign-in
    // This asserts the first, which is what a fresh install actually shows.
    resetSecureStore();

    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^Remember with (Face unlock|Fingerprint)$/)).toBeTruthy();
    });
    // and NOT the one-tap button, which would imply a stored credential exists
    expect(screen.queryByLabelText(/^Sign in with (Face unlock|Fingerprint)$/)).toBeNull();
  });

  it('offers one-tap sign-in once a credential is stored', async () => {
    resetSecureStore();
    await SecureStore.setItemAsync('careerpilot.biometric.email', 'a@b.com');
    await SecureStore.setItemAsync('careerpilot.biometric.password', 'secret');

    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^Sign in with (Face unlock|Fingerprint)$/)).toBeTruthy();
    });
    expect(screen.getByLabelText('Forget saved sign-in')).toBeTruthy();
  });

  it('the password toggle switches the field between hidden and shown', async () => {
    await render(
      <AllProviders>
        <SignInScreen />
      </AllProviders>,
    );

    const field = screen.getByLabelText('Password');
    expect(field.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByLabelText('Show password'));
    await waitFor(() => {
      expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    });
  });
});
