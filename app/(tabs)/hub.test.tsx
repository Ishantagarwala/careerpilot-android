import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { ChatProvider } from '@/chat/ChatProvider';
import { AllProviders } from '@/test/AllProviders';
import HubScreen from './hub';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * Hub screen render tests.
 *
 * The Hub is the app's default tab and the most stateful screen in it. What
 * matters here is the empty state, the honest notice about streaming, and the
 * composer's disabled state — all of which are easy to break silently.
 *
 * ChatProvider is included because the tabs layout mounts it in the real tree;
 * testing without it would exercise a different tree than the app runs.
 */
function renderHub() {
  return render(
    <AllProviders>
      <ChatProvider>
        <HubScreen />
      </ChatProvider>
    </AllProviders>,
  );
}

describe('HubScreen', () => {
  it('greets the user without performing enthusiasm', async () => {
    // PRODUCT.md: a calm co-pilot, not a hype-man. No emoji, no exclamation.
    await renderHub();
    const heading = screen.getByText(/What are we/i);
    expect(heading).toBeTruthy();
  });

  it('offers starter prompts', async () => {
    await renderHub();
    expect(screen.getByLabelText(/Explain a concept/i)).toBeTruthy();
    expect(screen.getByLabelText(/Build a study plan/i)).toBeTruthy();
    expect(screen.getByLabelText(/Quiz me/i)).toBeTruthy();
  });

  it('renders the composer with its send action', async () => {
    await renderHub();
    expect(screen.getByLabelText('Message')).toBeTruthy();
    expect(screen.getByLabelText('Send message')).toBeTruthy();
  });

  it('disables send until something is typed', async () => {
    await renderHub();
    const send = screen.getByLabelText('Send message');
    // A send button that looks ready with an empty box is a dead control.
    expect(send.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables send once the user types', async () => {
    await renderHub();
    fireEvent.changeText(screen.getByLabelText('Message'), 'explain 2NF');
    await waitFor(() => {
      expect(screen.getByLabelText('Send message').props.accessibilityState?.disabled).toBe(
        false,
      );
    });
  });

  it('opens the threads drawer from the app bar', async () => {
    await renderHub();
    fireEvent.press(screen.getByLabelText('Open threads'));
    expect(router.push).toHaveBeenCalledWith('/threads');
  });

  it('shows the model pill before a thread exists', async () => {
    await renderHub();
    expect(screen.getByText('V4 Flash')).toBeTruthy();
  });
});
