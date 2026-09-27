import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import RoadmapScreen from './roadmap';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/api/career', () => ({
  getRoadmap: jest.fn(),
  getRecommendations: jest.fn(),
  updateProgress: jest.fn(),
}));

const careerApi = jest.requireMock('@/api/career') as unknown as {
  getRoadmap: jest.Mock;
  getRecommendations: jest.Mock;
  updateProgress: jest.Mock;
};

const ROADMAP = {
  careerPath: 'Full Stack Developer',
  currentStage: 'beginner' as const,
  stages: [
    {
      name: 'beginner' as const,
      title: 'Foundations',
      milestones: [
        { _id: 'm1', title: 'HTML and CSS', completed: true },
        { _id: 'm2', title: 'JavaScript fundamentals', completed: true },
        { _id: 'm3', title: 'Node and Express APIs', completed: false },
      ],
    },
  ],
};

describe('RoadmapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    careerApi.getRoadmap.mockResolvedValue(ROADMAP);
    careerApi.getRecommendations.mockResolvedValue([]);
    careerApi.updateProgress.mockResolvedValue(null);
  });

  it('renders every milestone with its completion state', async () => {
    await render(
      <AllProviders>
        <RoadmapScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('HTML and CSS')).toBeTruthy();
    });
    expect(screen.getByText('Node and Express APIs')).toBeTruthy();
    // Two milestones are complete, so DONE legitimately appears twice.
    expect(screen.getAllByText('DONE')).toHaveLength(2);
    expect(screen.getByText('TO DO')).toBeTruthy();
  });

  it('exposes each milestone as a checkbox with its real state', async () => {
    // Screen-reader users must be able to tell done from not-done without
    // relying on the lime fill (DESIGN_SPEC §7).
    await render(
      <AllProviders>
        <RoadmapScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(
        screen.getByLabelText('HTML and CSS, completed').props.accessibilityState?.checked,
      ).toBe(true);
    });
    expect(
      screen.getByLabelText('Node and Express APIs, not completed').props.accessibilityState
        ?.checked,
    ).toBe(false);
  });

  it('filters to remaining and completed milestones', async () => {
    await render(
      <AllProviders>
        <RoadmapScreen />
      </AllProviders>,
    );
    await waitFor(() => expect(screen.getByText('HTML and CSS')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Left 1'));
    await waitFor(() => {
      expect(screen.queryByText('HTML and CSS')).toBeNull();
    });
    expect(screen.getByText('Node and Express APIs')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Done 2'));
    await waitFor(() => {
      expect(screen.getByText('HTML and CSS')).toBeTruthy();
    });
    expect(screen.queryByText('Node and Express APIs')).toBeNull();
  });

  it('writes progress when a milestone is toggled', async () => {
    await render(
      <AllProviders>
        <RoadmapScreen />
      </AllProviders>,
    );
    await waitFor(() => expect(screen.getByText('Node and Express APIs')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Node and Express APIs, not completed'));
    await waitFor(() => {
      expect(careerApi.updateProgress).toHaveBeenCalledWith({
        milestoneId: 'm3',
        completed: true,
      });
    });
  });

  it('flips the checkbox optimistically, before the write resolves', async () => {
    // A progress tap that waits on a round trip feels broken. The state must
    // change immediately; the write is confirmed afterwards.
    let resolveWrite: (v: unknown) => void = () => undefined;
    careerApi.updateProgress.mockReturnValue(
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
    );

    await render(
      <AllProviders>
        <RoadmapScreen />
      </AllProviders>,
    );
    await waitFor(() => expect(screen.getByText('Node and Express APIs')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Node and Express APIs, not completed'));

    // Still pending, yet already checked.
    await waitFor(() => {
      expect(
        screen.getByLabelText('Node and Express APIs, completed').props.accessibilityState
          ?.checked,
      ).toBe(true);
    });

    // Resolve inside act() and await the microtask queue, otherwise React
    // warns about a state update outside act — noise that would bury a real
    // warning later.
    await act(async () => {
      resolveWrite(null);
    });
  });

  it('explains how to get a roadmap when there is none', async () => {
    careerApi.getRoadmap.mockResolvedValue(null);
    await render(
      <AllProviders>
        <RoadmapScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('No roadmap yet')).toBeTruthy();
    });
    expect(screen.getByText(/Pin a career direction first/i)).toBeTruthy();
  });

  it('marks a fully-complete stage as complete', async () => {
    careerApi.getRoadmap.mockResolvedValue({
      ...ROADMAP,
      stages: [
        {
          name: 'beginner' as const,
          title: 'Foundations',
          milestones: [{ _id: 'x', title: 'Only one', completed: true }],
        },
      ],
    });
    await render(
      <AllProviders>
        <RoadmapScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Foundations.*COMPLETE/)).toBeTruthy();
    });
  });
});
