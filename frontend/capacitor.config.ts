import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cet4vocab.app',
  appName: '词跃 CET',
  webDir: 'dist',
  server: {
    url: 'https://cet4.35-212-219-217.sslip.io',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
