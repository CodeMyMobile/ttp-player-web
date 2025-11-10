export interface EnsureForScreenOptions {
  featureLabel: string;
}

/**
 * Mimics the native ensureForScreen analytics hook by logging feature usage.
 * This is intentionally lightweight for the web port but keeps call-sites aligned
 * with the mobile implementation so future instrumentation can plug in easily.
 */
export const ensureForScreen = ({ featureLabel }: EnsureForScreenOptions) => {
  if (!featureLabel) {
    return;
  }
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[ensureForScreen] ${featureLabel} viewed @ ${timestamp}`);
};

export default ensureForScreen;
