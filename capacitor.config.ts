import type { CapacitorConfig } from '@capacitor/cli';

// For production iOS: Load from your server (requires network)
// For development: Use localhost with live reload
const isProduction = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.sonomait.chief',
  appName: 'Chief',
  webDir: 'out', // Fallback, but we'll use server URL
  ios: {
    contentInset: 'never', // Let CSS handle safe area padding
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
    backgroundColor: '#faf7f2' // Light mode default - ThemePlugin updates for dark mode
  },
  server: {
    // Load from your Tailscale server via Caddy (port 8443)
    url: 'https://davids-mac-mini-1.bunny-bleak.ts.net:8443',
    cleartext: false, // Using HTTPS
  }
};

export default config;
