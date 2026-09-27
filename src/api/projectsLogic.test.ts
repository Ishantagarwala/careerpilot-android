import assert from 'node:assert/strict';
import { test } from 'node:test';

import { difficultyLabel, seatsRemaining } from './projectsLogic.ts';

test('open seats is the difference between size and members', () => {
  assert.equal(seatsRemaining({ teamSize: 4, currentMembers: 2 }), 2);
});

test('a full team reports zero seats, not a negative number', () => {
  assert.equal(seatsRemaining({ teamSize: 3, currentMembers: 3 }), 0);
});

test('an over-full roster is clamped rather than going negative', () => {
  // The schema permits currentMembers to exceed teamSize if a roster is edited
  // outside this flow; "-1 spots" on a card is worse than "Full".
  assert.equal(seatsRemaining({ teamSize: 2, currentMembers: 5 }), 0);
});

test('a one-person team with one member has no seats', () => {
  assert.equal(seatsRemaining({ teamSize: 1, currentMembers: 1 }), 0);
});

test('known difficulties get human labels', () => {
  assert.equal(difficultyLabel('beginner'), 'Beginner');
  assert.equal(difficultyLabel('intermediate'), 'Intermediate');
  assert.equal(difficultyLabel('advanced'), 'Advanced');
});

test('an unknown difficulty falls back to the raw value, not "undefined"', () => {
  // Guards against a server-side enum gaining a level this build predates.
  assert.equal(difficultyLabel('expert'), 'expert');
  assert.equal(difficultyLabel(''), '');
});
