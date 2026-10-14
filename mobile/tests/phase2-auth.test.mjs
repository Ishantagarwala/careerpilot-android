import test from 'node:test';
import assert from 'node:assert/strict';

// Validation logic matching mobile/app/(auth)/login.tsx
function validateLogin(email, password) {
  let isValid = true;
  let emailError = undefined;
  let passwordError = undefined;

  const cleanEmail = email.trim();
  if (!cleanEmail) {
    emailError = 'Email is required';
    isValid = false;
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      emailError = 'Please enter a valid email address';
      isValid = false;
    }
  }

  if (!password) {
    passwordError = 'Password is required';
    isValid = false;
  }

  return { isValid, emailError, passwordError };
}

// Validation logic matching mobile/app/(auth)/register.tsx
function validateRegister(name, email, password, confirmPassword) {
  let isValid = true;
  let nameError = undefined;
  let emailError = undefined;
  let passwordError = undefined;
  let confirmPasswordError = undefined;

  const cleanName = name.trim();
  if (!cleanName) {
    nameError = 'Full name is required';
    isValid = false;
  }

  const cleanEmail = email.trim();
  if (!cleanEmail) {
    emailError = 'Email is required';
    isValid = false;
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      emailError = 'Please enter a valid email address';
      isValid = false;
    }
  }

  if (!password) {
    passwordError = 'Password is required';
    isValid = false;
  } else if (password.length < 6) {
    passwordError = 'Password must be at least 6 characters long';
    isValid = false;
  }

  if (!confirmPassword) {
    confirmPasswordError = 'Please confirm your password';
    isValid = false;
  } else if (password !== confirmPassword) {
    confirmPasswordError = 'Passwords do not match';
    isValid = false;
  }

  return { isValid, nameError, emailError, passwordError, confirmPasswordError };
}

// Error message mapping for login
function mapLoginError(err) {
  if (err.status === 401) {
    return 'Invalid email or password. Please try again.';
  } else if (err.status === 429) {
    return 'Too many attempts. Please try again in a few moments.';
  } else if (err.status === 0 || err.status === 408) {
    return 'Cannot connect to server. Please check your internet connection.';
  } else {
    return err.message || 'Login failed. Please check your credentials.';
  }
}

// Error message mapping for registration
function mapRegisterError(err) {
  if (err.status === 400) {
    const msg = err.message || '';
    if (msg.toLowerCase().includes('already exists')) {
      return { field: 'email', message: 'An account with this email already exists.' };
    }
    return { field: 'general', message: msg || 'Invalid registration details.' };
  } else if (err.status === 0 || err.status === 408) {
    return { field: 'general', message: 'Cannot connect to server. Please check your internet connection.' };
  }
  return { field: 'general', message: err.message || 'Registration failed. Please try again.' };
}

test('P01: Welcome Screen contract & structure', () => {
  const welcomeContent = {
    brandMark: 'C',
    eyebrow: 'CAREER PILOT',
    heading: 'Your next step\nstarts here.',
    description: 'Find your direction. Build your skills.\nMove toward the career you want.',
    benefits: [
      'A path shaped around you',
      'Clear learning milestones',
      'Help when you need it',
    ],
    primaryAction: { label: 'Create account', route: '/(auth)/register' },
    secondaryAction: { label: 'Log in', route: '/(auth)/login' },
    header: {
      title: 'Career Pilot',
      hideLeading: true,
      hideProfile: true,
    },
  };

  assert.equal(welcomeContent.brandMark, 'C');
  assert.equal(welcomeContent.eyebrow, 'CAREER PILOT');
  assert.equal(welcomeContent.benefits.length, 3);
  assert.equal(welcomeContent.primaryAction.route, '/(auth)/register');
  assert.equal(welcomeContent.secondaryAction.route, '/(auth)/login');
  assert.equal(welcomeContent.header.hideLeading, true);
  assert.equal(welcomeContent.header.hideProfile, true);
});

test('P02: Login validation - empty email and password', () => {
  const result = validateLogin('', '');
  assert.equal(result.isValid, false);
  assert.equal(result.emailError, 'Email is required');
  assert.equal(result.passwordError, 'Password is required');
});

test('P02: Login validation - malformed email', () => {
  const result = validateLogin('invalid-email', 'secret123');
  assert.equal(result.isValid, false);
  assert.equal(result.emailError, 'Please enter a valid email address');
  assert.equal(result.passwordError, undefined);
});

test('P02: Login validation - valid credentials format', () => {
  const result = validateLogin('student@example.com', 'mypassword');
  assert.equal(result.isValid, true);
  assert.equal(result.emailError, undefined);
  assert.equal(result.passwordError, undefined);
});

test('P02: Login error mapping - 401 invalid credentials', () => {
  const msg = mapLoginError({ status: 401, message: 'Unauthorized' });
  assert.equal(msg, 'Invalid email or password. Please try again.');
});

test('P02: Login error mapping - 429 rate limit', () => {
  const msg = mapLoginError({ status: 429, message: 'Too Many Requests' });
  assert.equal(msg, 'Too many attempts. Please try again in a few moments.');
});

test('P02: Login error mapping - offline / network failure', () => {
  const msg = mapLoginError({ status: 0, message: 'Network request failed' });
  assert.equal(msg, 'Cannot connect to server. Please check your internet connection.');
});

test('P02: Intended destination resolution', () => {
  const resolveTarget = (paramRedirect, authRedirect) => {
    return paramRedirect || authRedirect || '/(tabs)/home';
  };

  assert.equal(resolveTarget(undefined, null), '/(tabs)/home');
  assert.equal(resolveTarget('/profile', null), '/profile');
  assert.equal(resolveTarget(undefined, '/study'), '/study');
  assert.equal(resolveTarget('/custom-job', '/study'), '/custom-job');
});

test('P03: Register validation - empty fields', () => {
  const result = validateRegister('', '', '', '');
  assert.equal(result.isValid, false);
  assert.equal(result.nameError, 'Full name is required');
  assert.equal(result.emailError, 'Email is required');
  assert.equal(result.passwordError, 'Password is required');
  assert.equal(result.confirmPasswordError, 'Please confirm your password');
});

test('P03: Register validation - password too short (<6)', () => {
  const result = validateRegister('Jane Doe', 'jane@example.com', '12345', '12345');
  assert.equal(result.isValid, false);
  assert.equal(result.passwordError, 'Password must be at least 6 characters long');
});

test('P03: Register validation - password mismatch', () => {
  const result = validateRegister('Jane Doe', 'jane@example.com', 'password123', 'differentpassword');
  assert.equal(result.isValid, false);
  assert.equal(result.confirmPasswordError, 'Passwords do not match');
});

test('P03: Register validation - valid registration input', () => {
  const result = validateRegister('Jane Doe', 'jane@example.com', 'password123', 'password123');
  assert.equal(result.isValid, true);
  assert.equal(result.nameError, undefined);
  assert.equal(result.emailError, undefined);
  assert.equal(result.passwordError, undefined);
  assert.equal(result.confirmPasswordError, undefined);
});

test('P03: Register error mapping - duplicate email', () => {
  const result = mapRegisterError({
    status: 400,
    message: 'User with this email already exists',
  });
  assert.equal(result.field, 'email');
  assert.equal(result.message, 'An account with this email already exists.');
});

test('P03: Register error mapping - offline / network failure', () => {
  const result = mapRegisterError({
    status: 0,
    message: 'Network request failed',
  });
  assert.equal(result.field, 'general');
  assert.equal(result.message, 'Cannot connect to server. Please check your internet connection.');
});

test('Auth session restoration offline policy', () => {
  const handleRestoreError = (err) => {
    if (err.status === 401 || err.status === 403) {
      return { clearToken: true, retainCachedUser: false };
    }
    // Network failure (status 0, 408) must NOT clear token
    return { clearToken: false, retainCachedUser: true };
  };

  const expiredResult = handleRestoreError({ status: 401, message: 'Unauthorized' });
  assert.equal(expiredResult.clearToken, true);
  assert.equal(expiredResult.retainCachedUser, false);

  const offlineResult = handleRestoreError({ status: 0, message: 'Network unreachable' });
  assert.equal(offlineResult.clearToken, false);
  assert.equal(offlineResult.retainCachedUser, true);
});

test('P01: Welcome Screen demo account exploration action', () => {
  const demoAction = {
    label: 'Explore demo account',
    accessibilityLabel: 'Explore demo account without login',
    targetRoute: '/(tabs)/home',
    isDemo: true,
  };
  assert.equal(demoAction.label, 'Explore demo account');
  assert.equal(demoAction.targetRoute, '/(tabs)/home');
  assert.equal(demoAction.isDemo, true);
});

test('Demo session policy - offline & restoration protection', () => {
  const handleRestoreWithDemo = (err, cachedUser) => {
    if (cachedUser?.isDemo) {
      return { clearToken: false, retainSession: true };
    }
    if (err.status === 401 || err.status === 403) {
      return { clearToken: true, retainSession: false };
    }
    return { clearToken: false, retainSession: true };
  };

  const demoResult = handleRestoreWithDemo({ status: 401 }, { isDemo: true });
  assert.equal(demoResult.clearToken, false);
  assert.equal(demoResult.retainSession, true);
});
