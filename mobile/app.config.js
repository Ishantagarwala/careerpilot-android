const appJson = require('./app.json');

/**
 * Fail the build loudly when EXPO_PUBLIC_API_URL is missing or unusable.
 *
 * Why this exists. The repo shipped two APKs that could not talk to the server:
 *
 *   preview     EXPO_PUBLIC_API_URL=http://192.168.1.7:3000   (a LAN address)
 *   production  unset -> src/api/client.ts falls back to
 *               http://10.0.2.2:3000, which is the Android EMULATOR's alias for
 *               the host machine and means nothing on a real phone
 *
 * Both produce an app that launches fine and then fails every request, which
 * reads as "the app is broken" rather than "the build was misconfigured". A
 * build-time error is far cheaper to diagnose than that.
 *
 * Set it in eas.json per profile, or as an EAS environment variable:
 *   production / preview : https://careerpilot.cc
 *   development          : http://<your-lan-ip>:3000  (device on the same wifi)
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

/** Hosts that can only ever work from an emulator or the dev machine. */
const LOOPBACK_HOSTS = ['10.0.2.2', '10.0.3.2', 'localhost', '127.0.0.1', '::1'];

/**
 * RFC 1918 private ranges. A phone on mobile data cannot route to these, and
 * neither can anyone else's device — which is exactly how `192.168.1.7:3000`
 * shipped as the preview API URL and produced an app that failed every request
 * for everyone but the author, on their own wifi.
 */
function isPrivateHost(host) {
  if (LOOPBACK_HOSTS.includes(host)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function assertApiUrlIsUsable(profile) {
  if (!apiUrl) {
    throw new Error(
      [
        'EXPO_PUBLIC_API_URL is not set for this build.',
        '',
        'Without it the app falls back to http://10.0.2.2:3000, which only works',
        'in an Android emulator. Every request from a real device would fail.',
        '',
        'Set it in eas.json under build.<profile>.env, e.g.',
        '  "EXPO_PUBLIC_API_URL": "https://careerpilot.cc"',
      ].join('\n')
    );
  }

  let host;
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL is not a valid URL: ${apiUrl}`);
  }

  if (!isPrivateHost(host)) return;

  // A dev build is *meant* to point at the developer's own machine.
  if (profile === 'development') return;

  throw new Error(
    [
      `EXPO_PUBLIC_API_URL points at ${host}, which no real device can reach`,
      `off the local network. This is the "${profile}" profile, so the build`,
      'would ship an app that fails every request.',
      '',
      '  10.0.2.2 / 10.0.3.2   the Android emulator alias for the host machine',
      '  localhost / 127.0.0.1  the device itself',
      '  10.x / 192.168.x / 172.16-31.x   private, LAN-only',
      '',
      'Use the deployed origin, e.g. "https://careerpilot.cc".',
      'Keep a LAN address only in the "development" profile, where a dev client',
      'runs on a device sharing your wifi.',
    ].join('\n')
  );
}

/*
 * Only enforce this for real builds. `expo start`, `expo export` and the test
 * suite run without the variable, and failing those would be noise.
 */
const PROFILE = process.env.EAS_BUILD_PROFILE || process.env.APP_VARIANT || null;
if (process.env.EAS_BUILD === 'true') {
  assertApiUrlIsUsable(PROFILE);
}

module.exports = ({ config }) => ({
  ...appJson.expo,
  ...config,
  extra: {
    ...appJson.expo.extra,
    ...(config && config.extra),
    // Surfaced in-app (Me > About) so a tester can see which server a build
    // actually targets without digging through EAS logs.
    apiBaseUrl: apiUrl || null,
  },
});
