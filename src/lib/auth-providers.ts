export interface ConfiguredProvider {
  id: "google" | "microsoft-entra-id" | "apple";
  name: string;
}

/** Which SSO providers have credentials set, so the login screen only
 * shows buttons that will actually work. */
export function getConfiguredProviders(): ConfiguredProvider[] {
  const providers: ConfiguredProvider[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({ id: "google", name: "Google" });
  }
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET) {
    providers.push({ id: "microsoft-entra-id", name: "Microsoft" });
  }
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.push({ id: "apple", name: "Apple" });
  }
  return providers;
}
