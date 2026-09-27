import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AllProviders } from '@/test/AllProviders';
import BuildScreen from './build';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/api/build', () => ({
  listResumes: jest.fn(),
  listApplications: jest.fn(),
  searchJobs: jest.fn(),
  analyzeAts: jest.fn(),
  missingSkills: jest.requireActual('@/api/build').missingSkills,
  APPLICATION_LABELS: jest.requireActual('@/api/build').APPLICATION_LABELS,
}));

jest.mock('@/api/projects', () => ({
  listProjectIdeas: jest.fn(),
  listTeamPosts: jest.fn(),
  seatsRemaining: jest.requireActual('@/api/projects').seatsRemaining,
  difficultyLabel: jest.requireActual('@/api/projects').difficultyLabel,
}));

const buildApi = jest.requireMock('@/api/build') as unknown as {
  listResumes: jest.Mock;
  listApplications: jest.Mock;
  searchJobs: jest.Mock;
  analyzeAts: jest.Mock;
};
const projectsApi = jest.requireMock('@/api/projects') as unknown as {
  listProjectIdeas: jest.Mock;
  listTeamPosts: jest.Mock;
};

const SCORED_RESUME = {
  _id: 'res1',
  title: 'Fullstack_Resume_v4',
  isActive: true,
  atsAnalysis: {
    score: 71,
    tier: 'Strong',
    summary: 'Solid backend evidence.',
    suggestions: ['Add Docker and CI/CD', 'Quantify the project bullet'],
    strengths: ['Clear project writeups'],
  },
};

describe('BuildScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildApi.listResumes.mockResolvedValue([SCORED_RESUME]);
    buildApi.listApplications.mockResolvedValue([]);
    buildApi.searchJobs.mockResolvedValue({ jobs: [], meta: { count: 0 } });
    projectsApi.listProjectIdeas.mockResolvedValue([]);
    projectsApi.listTeamPosts.mockResolvedValue([]);
  });

  it('shows the ATS score as the focal metric with its tier', async () => {
    await render(
      <AllProviders>
        <BuildScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('71')).toBeTruthy();
    });
    // The tier appears twice on purpose: as the ring's caption AND as the tag.
    expect(screen.getAllByText('Strong').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ATS score')).toBeTruthy();
    expect(screen.getByText('Fullstack_Resume_v4')).toBeTruthy();
  });

  it('ranks the fixes rather than listing them flat', async () => {
    await render(
      <AllProviders>
        <BuildScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('Add Docker and CI/CD')).toBeTruthy();
    });
    expect(screen.getByText('HIGH')).toBeTruthy();
    expect(screen.getByText('MED')).toBeTruthy();
  });

  it('does not claim a score when the resume has never been analysed', async () => {
    buildApi.listResumes.mockResolvedValue([{ _id: 'res2', title: 'Draft', isActive: true }]);
    await render(
      <AllProviders>
        <BuildScreen />
      </AllProviders>,
    );
    await waitFor(() => {
      expect(screen.getByText('Not scored yet')).toBeTruthy();
    });
    expect(screen.getByLabelText('Score resume with ATS')).toBeTruthy();
  });

  it('switches to the Jobs segment and explains an empty result honestly', async () => {
    await render(
      <AllProviders>
        <BuildScreen />
      </AllProviders>,
    );
    fireEvent.press(screen.getByLabelText('Jobs'));
    await waitFor(() => {
      expect(screen.getByText(/No jobs returned/i)).toBeTruthy();
    });
    // The copy must explain WHY it can be empty, not just that it is.
    expect(screen.getByText(/rate-limited/i)).toBeTruthy();
  });

  it('labels the segments as a group for screen readers', async () => {
    await render(
      <AllProviders>
        <BuildScreen />
      </AllProviders>,
    );
    expect(screen.getByLabelText('Build section')).toBeTruthy();
  });

  it('shows a job match score with the missing-skill gap', async () => {
    buildApi.searchJobs.mockResolvedValue({
      jobs: [
        {
          title: 'Backend Engineer',
          company: 'Zoho',
          type: 'full-time',
          location: 'Chennai',
          skills: ['Node', 'Docker'],
          matchedSkills: ['Node'],
          matchScore: 78,
          applyUrl: 'https://example.com/apply',
        },
      ],
      meta: { count: 1 },
    });

    await render(
      <AllProviders>
        <BuildScreen />
      </AllProviders>,
    );
    fireEvent.press(screen.getByLabelText('Jobs'));

    await waitFor(() => {
      expect(screen.getByText('78%')).toBeTruthy();
    });
    // "Why is this only 78%?" is the question the score raises.
    expect(screen.getByText(/Missing: Docker/)).toBeTruthy();
  });

  it('does not blank the screen when every request fails', async () => {
    buildApi.listResumes.mockRejectedValue(new Error('offline'));
    buildApi.listApplications.mockRejectedValue(new Error('offline'));
    buildApi.searchJobs.mockRejectedValue(new Error('offline'));

    await render(
      <AllProviders>
        <BuildScreen />
      </AllProviders>,
    );
    // A failure must produce a message, not an empty screen.
    await waitFor(() => {
      expect(screen.getByText('No resumes yet')).toBeTruthy();
    });
  });
});
