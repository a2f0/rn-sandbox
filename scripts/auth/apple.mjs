// Turns on Sign in with Apple in Identity Platform, through api (googleApi.mjs).
// Terraform's resource can't take the key. Returns whether the web and Android
// can sign in with Apple, which needs a key: this one, or the project's.
export async function configureApple({
  api,
  identityPlatform,
  appId,
  teamId,
  servicesId,
  key,
}) {
  const existing = await api('GET', `${identityPlatform}/apple.com`);
  const config = {
    enabled: true,
    clientId: servicesId,
    appleSignInConfig: {
      // Native iOS sign-in's tokens are for the app's bundle ID.
      bundleIds: [appId],
      // The web and Android sign in through the Services ID, whose code
      // Firebase exchanges with a client secret it signs with this key.
      ...(key && {
        codeFlowConfig: { teamId, keyId: key.id, privateKey: key.privateKey },
      }),
    },
  };
  if (existing) {
    // Without a key here, leave the one the project has in place.
    const fields = key
      ? 'enabled,clientId,appleSignInConfig'
      : 'enabled,clientId,appleSignInConfig.bundleIds';
    await api(
      'PATCH',
      `${identityPlatform}/apple.com?updateMask=${fields}`,
      config,
    );
  } else {
    await api('POST', `${identityPlatform}?idpId=apple.com`, config);
  }
  return (
    key !== null || Boolean(existing?.appleSignInConfig?.codeFlowConfig?.keyId)
  );
}
