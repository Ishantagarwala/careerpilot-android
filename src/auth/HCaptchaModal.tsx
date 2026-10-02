import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { brandLight, radius, space } from '@/theme/tokens';

/**
 * hCaptcha, the fallback bot gate.
 *
 * WHY A WEBVIEW
 *
 * hCaptcha ships as a web widget and there is no native Android SDK for it.
 * The server accepts a captcha token from the mobile route, so embedding the
 * widget is the way to satisfy it without Play Integrity — which this app
 * cannot use, because attestation requires a Play Console listing and an
 * install from Google Play.
 *
 * The page is loaded with an https baseUrl rather than as a bare data URL so
 * hCaptcha sees an origin its site key is configured for; a page with no origin
 * is rejected with an opaque error.
 */

/** The hCaptcha page. Callbacks are defined BEFORE the api.js script tag. */
function captchaHtml(siteKey: string): string {
  return (
    '<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">' +
    '<style>' +
    'html,body{margin:0;padding:0;height:100%;background:#f4f6e8;}' +
    '#wrap{display:flex;align-items:center;justify-content:center;min-height:100%;padding:16px;}' +
    '</style>' +
    '<script>' +
    'function rnPost(payload){' +
    '  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }' +
    '}' +
    'function onSolve(token){ rnPost({ token: token }); }' +
    'function onError(err){ rnPost({ error: String(err) }); }' +
    '</script>' +
    '<script src="https://js.hcaptcha.com/1/api.js" async defer></script>' +
    '</head><body><div id="wrap">' +
    '<div class="h-captcha" data-sitekey="' + siteKey + '"' +
    ' data-callback="onSolve" data-error-callback="onError"></div>' +
    '</div></body></html>'
  );
}

export function HCaptchaModal({
  visible,
  siteKey,
  onToken,
  onError,
  onCancel,
}: {
  visible: boolean;
  siteKey: string;
  onToken: (token: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const html = useMemo(() => captchaHtml(siteKey), [siteKey]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { token?: string; error?: string };
      if (data.token) onToken(data.token);
      else if (data.error) onError('The captcha could not run. Try again.');
    } catch {
      onError('Could not read the captcha response.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Quick check</Text>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel captcha"
            hitSlop={12}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Confirm you are a person to finish signing in.
        </Text>
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://careerpilot.cc' }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={brandLight.foreground} />
            </View>
          )}
          style={styles.webview}
        />
      </SafeAreaView>
    </Modal>
  );
}

const b = brandLight;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: b.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s2,
  },
  title: {
    fontFamily: 'Anybody_700Bold',
    fontSize: 18,
    color: b.foreground,
    letterSpacing: -0.3,
  },
  cancel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: b.mutedForeground,
  },
  hint: {
    paddingHorizontal: space.s4,
    paddingBottom: space.s3,
    fontSize: 13.5,
    lineHeight: 20,
    color: b.mutedForeground,
  },
  webview: { flex: 1, backgroundColor: b.background, borderRadius: radius.brand },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
