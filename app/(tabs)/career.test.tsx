import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import CareerScreen from './career';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/api/career', () => ({
  getRoadmap: jest.fn(),
  getRecommendations: jest.fn(),
  updateProgress: jest.fn(),
}));

/** The real module is re-imported after the mock so the test drives the data. */
const careerApi = jest.requireMock('@/api/career') as {
  getRoadmap: jest.Mock;
  getRecommendations: jest.Mock;
};

const ROADMAP = {
  careerPath: 'Full Stack Developer',
  currentStage: 'beginner' as const,
  stages: [
    {
      name: 'beginner' as const,
      milestones: [
        { _id: 'm1', title: 'HTML and CSS', completed: true },
        { _id: 'm2', title: 'JavaScript fundamentals', completed: true },
        { _id: 'm3', title: 'Node and Express APIs', completed: false },
      ],
    },
  ],
};

describe('CareerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    careerApi.getRoadmap.mockResolvedValue(ROADMAP);
    careerApi.getRecommendations.mockResolvedValue([
      {
        _id: 'r1',
        careerPath: 'Full Stack Developer',
        matchScore: 92,
        reasoning: 'Strong overlap with your projects.',
        selected: true,
      },
    ]);
  });

  it('shows the pinned direction and its match score', async () => {
    await render(
      <AllProviders>
        <CareerScreen />
      </AllProviders>,
    );
    // It legitimately appears twice: the pinned direction card AND the
    // recommendation row it came from. Asserting a single match would be wrong.
    await waitFor(() => {
      expect(screen.getAllByText('Full Stack Developer').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('92% MATCH')).toBeTruthy();
    expect(screen.getByText('Your direction')).toBeTruthy();
  });

  it('reports roadmap progress in milestones, not a bare percentage', async () => {
    // "5 of 13 milestones complete" tells the user where they are; "38%" alone
    // does not.
    await render(
      <AllProviders>
        <CareerScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('2 of 3 milestones complete')).toBeTruthy();
    });
    expect(screen.getByText('67%')).toBeTruthy();
  });

  it('surfaces the NEXT incomplete milestone, not the first one overall', async () => {
    // The decisive detail: it must skip the two completed milestones.
    await render(
      <AllProviders>
        <CareerScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('Node and Express APIs')).toBeTruthy();
    });
    expect(screen.getByText('Next milestone')).toBeTruthy();
    expect(screen.getByLabelText(/Mark Node and Express APIs complete/i)).toBeTruthy();
    // and it must NOT be showing an already-finished milestone as next
    expect(screen.queryByText('HTML and CSS')).toBeNull();
  });

  it('explains how to get a direction when none is pinned', async () => {
    careerApi.getRecommendations.mockResolvedValue([]);
    await render(
      <AllProviders>
        <CareerScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('No direction pinned yet.')).toBeTruthy();
    });
    // and it must offer a CTA that actually goes somewhere — the assessment
    // screen now exists, so this asserts the working control rather than a
    // placeholder label.
    expect(screen.getByLabelText('Start the assessment')).toBeTruthy();
  });

  it('does not blank the screen when the roadmap is missing', async () => {
    careerApi.getRoadmap.mockResolvedValue(null);
    await render(
      <AllProviders>
        <CareerScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getAllByText('Full Stack Developer').length).toBeGreaterThanOrEqual(1);
    });
    // direction still shown, because recommendations loaded fine
    expect(screen.getByText(/No roadmap yet/i)).toBeTruthy();
  });
});
