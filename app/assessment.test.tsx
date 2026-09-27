import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import AssessmentScreen from './assessment';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/api/assessment', () => ({
  runAssessment: jest.fn(),
  generateNicheCatalog: jest.fn(),
  getAssessmentProfile: jest.fn(),
  CAREER_DOMAINS: jest.requireActual('@/api/assessment').CAREER_DOMAINS,
  DOMAIN_LABELS: jest.requireActual('@/api/assessment').DOMAIN_LABELS,
}));

// The screen refreshes the Career tab on success.
jest.mock('@/career/useCareer', () => ({
  useCareer: () => ({ reload: jest.fn(async () => undefined) }),
}));

const assessApi = jest.requireMock('@/api/assessment') as unknown as {
  runAssessment: jest.Mock;
  generateNicheCatalog: jest.Mock;
};

/**
 * Assessment wizard tests.
 *
 * The wizard's job is to not waste the user's allowance: submitting costs two
 * model calls out of five per hour. So the gating matters more than the layout —
 * an incomplete step must not advance, and a failure must not discard answers.
 *
 * TWO HARNESS RULES learned the hard way here, recorded because they cost real
 * time:
 *
 *  1. Never press a DISABLED control. In this suite, firing a press at the
 *     disabled Continue button corrupted every subsequent test in the file —
 *     later renders then reported the screen as empty. Assert on the disabled
 *     state instead of pressing it.
 *  2. Await between dependent presses. React applies one press's state update
 *     asynchronously, so pressing a chip and Continue in the same tick leaves
 *     Continue seeing the pre-update disabled state.
 */

async function mountWizard() {
  await render(
    <AllProviders>
      <AssessmentScreen />
    </AllProviders>,
  );
}

/** Wait until Continue is enabled — the precondition for advancing a step. */
async function continueEnabled() {
  await waitFor(() => {
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false);
  });
}

async function pressContinue() {
  await continueEnabled();
  fireEvent.press(screen.getByLabelText('Continue'));
}

/** Select a chip and wait for it to register before anything else happens. */
async function select(label: string) {
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => {
    expect(screen.getByLabelText(label).props.accessibilityState?.checked).toBe(true);
  });
}

/** Walk to the goals step, the last one before skills. */
async function advanceToGoals() {
  fireEvent.press(screen.getByLabelText('Technology'));
  await pressContinue();
  await waitFor(() => expect(screen.getByText('What interests you?')).toBeTruthy());

  await select('Open source');
  await pressContinue();
  await waitFor(() => expect(screen.getByText('What have you studied?')).toBeTruthy());

  await select('Programming');
  await pressContinue();
  await waitFor(() => expect(screen.getByText('What do you want to reach?')).toBeTruthy());
}

/** Walk all the way to skills and add one. */
async function advanceToSkills() {
  await advanceToGoals();
  fireEvent.changeText(
    screen.getByLabelText('Your goals'),
    'I want to work as a backend developer within a year.',
  );
  await pressContinue();
  await waitFor(() => expect(screen.getByText('What can you already do?')).toBeTruthy());

  fireEvent.changeText(screen.getByLabelText('Skill name'), 'JavaScript');
  // The Add button is DISABLED until the field has content, so the press must
  // wait for enablement — pressing a disabled control silently does nothing,
  // which is the same trap as rule 1 above.
  await waitFor(() => {
    expect(screen.getByLabelText('Add skill').props.disabled).toBeFalsy();
  });
  fireEvent.press(screen.getByLabelText('Add skill'));
  await waitFor(() => expect(screen.getByText('JavaScript')).toBeTruthy());
}

describe('AssessmentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assessApi.runAssessment.mockResolvedValue({
      recommendations: [],
      selectionPreserved: true,
    });
    assessApi.generateNicheCatalog.mockResolvedValue({
      interests: ['Menu planning'],
      subjects: ['Hospitality'],
      skills: [],
    });
  });

  it('opens on the domain step with all nine domains', async () => {
    await mountWizard();
    expect(screen.getByText('What field are you aiming at?')).toBeTruthy();
    expect(screen.getByLabelText('Technology')).toBeTruthy();
    expect(screen.getByLabelText('Other / Niche Path')).toBeTruthy();
    // Nine, matching CAREER_DOMAINS on the server.
    expect(screen.getAllByRole('radio').length).toBe(9);
  });

  it('will not advance until a domain is chosen', async () => {
    await mountWizard();
    // Asserted, not pressed: firing at a disabled control corrupted later tests.
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByLabelText('Technology'));
    await continueEnabled();
  });

  it('offers domain-appropriate suggestions rather than a blank list', async () => {
    await mountWizard();
    fireEvent.press(screen.getByLabelText('Technology'));
    await pressContinue();

    await waitFor(() => expect(screen.getByText('What interests you?')).toBeTruthy());
    expect(screen.getByLabelText('Open source')).toBeTruthy();
  });

  it('will not advance from interests with nothing selected', async () => {
    await mountWizard();
    fireEvent.press(screen.getByLabelText('Technology'));
    await pressContinue();
    await waitFor(() => expect(screen.getByText('What interests you?')).toBeTruthy());

    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);
    await select('Open source');
    await continueEnabled();
  });

  it('clears the previous domain selections when the domain changes', async () => {
    // Otherwise a leftover interest from Technology silently leaks into a
    // Healthcare assessment and skews the recommendation.
    await mountWizard();
    fireEvent.press(screen.getByLabelText('Technology'));
    await pressContinue();
    await waitFor(() => expect(screen.getByText('What interests you?')).toBeTruthy());
    await select('Open source');

    fireEvent.press(screen.getByLabelText('Previous step'));
    await waitFor(() => expect(screen.getByText('What field are you aiming at?')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Healthcare'));
    await waitFor(() => {
      expect(screen.getByLabelText('Healthcare').props.accessibilityState?.selected).toBe(true);
    });
    await pressContinue();
    await waitFor(() => expect(screen.getByText('What interests you?')).toBeTruthy());

    // The old interest is gone, so Continue is disabled again.
    expect(screen.getByLabelText('Public health').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);
  });

  it('requires a substantive goal rather than a few words', async () => {
    // The model reasons from this text; "get a job" produces a generic result.
    await mountWizard();
    await advanceToGoals();

    fireEvent.changeText(screen.getByLabelText('Your goals'), 'get a job');
    await waitFor(() => {
      expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);
    });

    fireEvent.changeText(
      screen.getByLabelText('Your goals'),
      'I want to become a backend developer at a product company within a year.',
    );
    await continueEnabled();
  });

  it('explains the cost before spending it', async () => {
    await mountWizard();
    await advanceToSkills();
    expect(screen.getByText(/two AI calls from your hourly allowance/i)).toBeTruthy();
  });

  it('submits the full payload and returns to Career on success', async () => {
    await mountWizard();
    await advanceToSkills();

    fireEvent.press(screen.getByLabelText('Get my recommendations'));

    await waitFor(() => {
      expect(assessApi.runAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          careerDomain: 'technology',
          interests: ['Open source'],
          subjects: ['Programming'],
          skills: [{ name: 'JavaScript', level: 'intermediate' }],
        }),
      );
    });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/career');
    });
  });

  it('keeps every answer when the request fails', async () => {
    // The call is budgeted at 5 per hour, so discarding answers would cost the
    // user one of their attempts for nothing.
    assessApi.runAssessment.mockRejectedValue(
      new Error('Rate limited. Try again in 40 minutes.'),
    );

    await mountWizard();
    await advanceToSkills();

    fireEvent.press(screen.getByLabelText('Get my recommendations'));

    await waitFor(() => expect(screen.getByText(/Rate limited/i)).toBeTruthy());
    // still on the skills step, answer intact
    expect(screen.getByText('JavaScript')).toBeTruthy();
    expect(screen.getByText('What can you already do?')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('offers niche suggestions for a path the built-in domains do not cover', async () => {
    await mountWizard();
    fireEvent.press(screen.getByLabelText('Other / Niche Path'));

    await waitFor(() => expect(screen.getByLabelText('Niche description')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Niche description'), 'hotel management');
    // Disabled below three characters, so wait for enablement before pressing.
    await waitFor(() => {
      expect(
        screen.getByLabelText('Suggest interests').props.accessibilityState?.disabled,
      ).toBe(false);
    });
    fireEvent.press(screen.getByLabelText('Suggest interests'));

    await waitFor(() => {
      expect(assessApi.generateNicheCatalog).toHaveBeenCalledWith('hotel management');
    });
  });
});
