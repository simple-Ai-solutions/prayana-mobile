// openInApp — opens a web page (legal docs, policies) in an in-app browser
// sheet instead of bouncing the user out to Chrome/Safari. Non-http links
// (tel:, mailto:, wa.me deep links) still go through Linking.
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const TEAL = '#0d9488';

export const SITE_URL = 'https://prayanaai.com';

export async function openInApp(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) {
    await Linking.openURL(url).catch(() => {});
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: '#ffffff',
      controlsColor: TEAL,
      enableBarCollapsing: true,
      showTitle: true,
      presentationStyle:
        Platform.OS === 'ios'
          ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
          : WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
    });
  } catch {
    // No custom-tabs capable browser on the device — fall back to the system one.
    await Linking.openURL(url).catch(() => {});
  }
}
