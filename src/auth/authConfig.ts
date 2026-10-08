import config from './config.json';

// scripts/auth/provision.mjs writes config.json from the provisioned Firebase
// project. Until it has, each section is null and that sign-in is off.
export type AuthConfig = {
  // Firebase's web config, which identifies the project to clients.
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  } | null;
  google: {
    // The OAuth web client: native sign-in asks for ID tokens for it, which
    // Firebase accepts.
    webClientId: string;
    // Null leaves Google off on iOS.
    iosClientId: string | null;
  } | null;
  apple: {
    // The Services ID, which signs in on Android and the web.
    servicesId: string;
    // A return URL registered on the Services ID. Android reads the result
    // before the browser loads it.
    redirectUri: string;
  } | null;
};

export const authConfig: AuthConfig = config;
