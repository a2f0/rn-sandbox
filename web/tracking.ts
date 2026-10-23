/// <reference types="vite/client" />
import { createTracker } from '@a2f0/ct-client';

/** Creation is inert; only the web entrypoint explicitly calls init(). */
export function createWebTracker() {
  if (
    !import.meta.env.PROD ||
    typeof window === 'undefined' ||
    window.location.origin !== 'https://rn-sandbox.a2f0.net'
  ) {
    return undefined;
  }
  return createTracker({
    site: 'rn-sandbox',
    app: 'web-app',
    environment: 'production',
    capture: 'all',
    overrideGpc: true,
    page: () => '/',
  });
}
