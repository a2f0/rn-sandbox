# Operations

See the [README](../README.md) for setup and normal commands. Merging runs CI
without deploying. Store uploads and web deployments are explicit operations;
do not run provisioning or release lanes as tooling validation.

## Web deployment

```bash
bun run preview:deploy:web  # build and dry-run assets without deploying
bun run deploy:web          # build and deploy to rn-sandbox.a2f0.net
```

`deploy:web` deploys `web/build` with
[Wrangler](https://developers.cloudflare.com/workers/wrangler/) as the
`rn-sandbox` Worker (`wrangler.jsonc`), which serves it at
<https://rn-sandbox.a2f0.net>. Wrangler attaches that custom domain on deploy;
run `bunx wrangler login` first, with the Cloudflare account that holds the
a2f0.net zone.

The site is a single page with no client-side routes. `web/index.html` carries
its search and social metadata, with <https://rn-sandbox.a2f0.net/> as the
canonical URL, and `web/public/` holds `robots.txt`, `sitemap.xml`, and
`404.html`, which the Worker returns with a 404 status for any other path. The
Playwright suite checks them in the production build, and the 404 status
under `wrangler dev`. There is no staging
tier; a new one needs `X-Robots-Tag: noindex, nofollow` and a matching robots
meta tag, without the canonical URL or sitemap.

Always run the deployment preview first. Wrangler's dry run checks the local
assets and configuration; also compare the live account, Worker, routes,
bindings, resource IDs, and migrations before an authorized deploy. Skip an
upgrade if it would delete or recreate resources, or its remote effects cannot
be verified. Push and merge workflows run tests without deploying.

## Sign-in

The app signs in with Google or Apple through
[Firebase Authentication](https://firebase.google.com/docs/auth) with
Identity Platform, and shows who's signed in above the round-trip cases:

- **iOS:** native Google Sign-In
  ([`@react-native-google-signin/google-signin`](https://github.com/react-native-google-signin/google-signin))
  and Sign in with Apple
  ([`@invertase/react-native-apple-authentication`](https://github.com/invertase/react-native-apple-authentication)).
- **Android:** native Google Sign-In. Apple has no Android SDK, so Sign in with
  Apple runs Apple's web flow in a WebView, through the Services ID.
- **Web:** Firebase's popups for both.

On iOS and Android, `src/auth/session.ts` hands the provider's ID token to
Firebase; the web uses `src/auth/session.web.ts`. The native session is kept in
memory, so relaunching the app signs out. Until `src/auth/config.json` holds a
provisioned project, the bar says sign-in isn't set up.

### Provisioning

`bun run auth:provision` (`scripts/auth/provision.mjs`) sets up the backend and
writes the app's config:

1. Terraform (`infra/auth`) creates the `a2f0-rn-sandbox` Google Cloud project,
   Firebase, Identity Platform and its authorized domains, and the iOS,
   Android, and web Firebase apps. Its state is in this project's Cloudflare
   R2 bucket, `rn-sandbox-terraform-state`. The Android app lists the SHA-1s
   of the keys that sign it: Google Play's app signing key, the upload key,
   and one Mac's debug keystore. Add others to `android_sha1_hashes` in
   `infra/auth/variables.tf`.
2. The Firebase CLI turns on Google sign-in, which creates the OAuth consent
   screen and client IDs. They have no public API.
3. The Identity Platform API turns on Apple sign-in with the Sign in with Apple
   key, which Terraform's resource can't take.
4. It writes `src/auth/config.json`, and adds Google's reversed iOS client ID to
   `ios/sandbox/Info.plist` as a URL scheme. Commit both, then rebuild.

It reads the R2 state key, `TF_STATE_ACCESS_KEY_ID` and
`TF_STATE_SECRET_ACCESS_KEY`, from `.secrets/prod/app.env` and passes it to
Terraform alone, as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` without
`AWS_PROFILE` or `AWS_SESSION_TOKEN`. It reads the billing account from
`RN_SANDBOX_GCP_BILLING_ACCOUNT` in `.secrets/prod/app.env`, or uses your only
open one. Identity Platform needs billing; its free tier covers the sandbox.
Set `TF_VAR_project_id` if the project ID is taken. `RN_SANDBOX_SECRETS_DIR`
names a folder to read in place of `.secrets/prod`.

One-time steps that have no API:

1. Log in to Google Cloud as the account that should own the project. Its email
   becomes the consent screen's support email.

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

2. In the Apple Developer portal's
   [Identifiers](https://developer.apple.com/account/resources/identifiers/list/serviceId),
   register the Services ID `net.a2f0.sandbox.rn.signin`. Enable Sign in with
   Apple and configure it with the primary App ID `net.a2f0.sandbox.rn`, the
   domain `a2f0-rn-sandbox.firebaseapp.com`, and the return URL
   `https://a2f0-rn-sandbox.firebaseapp.com/__/auth/handler`.
3. Under [Keys](https://developer.apple.com/account/resources/authkeys/list),
   create a key with Sign in with Apple for the same App ID. Save it as
   `.secrets/prod/AuthKey_<key ID>.p8`, and add
   `RN_SANDBOX_APPLE_SIGN_IN_KEY_ID=<key ID>` to `.secrets/prod/app.env`.

Then run `bun run auth:provision`. Until steps 2 and 3 are done, Apple sign-in
works on iOS only; run it again after them.

The App ID already has the Sign in with Apple capability, set through the App
Store Connect API, and the match App Store profile includes it. After changing
`infra/auth`, check it:

```bash
terraform fmt -check -recursive infra
terraform -chdir=infra/auth init -backend=false
terraform -chdir=infra/auth validate
```

## Store releases

fastlane ships the store builds. `fastlane/Fastfile` imports the iOS and
Android lanes from `fastlane/lanes/`, and `fastlane/lib/native_release_target.rb`
declares the release tiers. rn-sandbox has one, `production`: the app
`net.a2f0.sandbox.rn` in both stores, named "RN Sandbox". `NATIVE_RELEASE_TIER`
selects the tier and defaults to `production`; any other tier fails before a
lane runs.

Each routine lane has a package script that sets the tier. Arguments pass
through to fastlane, as in `bun run android:upload-release track:beta`:

```bash
bun run ios:build-release
bun run ios:upload-release
bun run ios:profiles
bun run android:build-release
bun run android:upload-release
```

Run the other lanes with `bundle exec fastlane <platform> <lane> [key:value ...]`.

| Lane | Does | Options |
| --- | --- | --- |
| `ios build_release` | Signed App Store IPA in `ios/build/release/`, without uploading | `build_number:` |
| `ios upload_release` | `build_release`, then uploads to TestFlight | `build_number:` |
| `ios profiles` | Creates or renews the match App Store profile | `force:true` regenerates it |
| `android build_release` | Signed release App Bundle, without uploading | `build_number:` |
| `android upload_release` | `build_release`, then uploads to a Google Play track | `build_number:`, `track:` (`internal`), `release_status:` (`completed`) |
| `ios register_identifiers` | Registers the bundle ID (API key) | |
| `ios create_app` | One time, interactive: creates the App Store Connect app (Apple ID and 2FA) | |

`build_number:` is the iOS build number or the Android version code. Without
it, the lanes use one more than the highest already in TestFlight or on Google
Play. `ios profiles` uses the App Store Connect API key; regenerate the profile
with `force:true` after the bundle ID's capabilities or the distribution
certificate change. `ios create_app` also creates the bundle ID and an
`Internal` TestFlight group that gets every build, then runs `profiles`.

Store credentials come from `.secrets/prod/`. `.secrets` is a gitignored
symlink to the external `matrix-secrets/rn-sandbox` directory, managed and
backed up from [matrix](https://github.com/a2f0/matrix/blob/main/docs/secrets.md).
Follow the [clone-linking instructions](https://github.com/a2f0/matrix/blob/main/docs/secrets.md#linking-a-clone)
for the checkout location: a matrix checkout uses
`ln -s ../../../matrix-secrets/rn-sandbox .secrets` from its repository root; a
standalone clone beside `matrix-secrets` uses
`ln -s ../matrix-secrets/rn-sandbox .secrets`. Verify the link is ignored with
`git check-ignore .secrets`. `prod/` holds the App Store Connect API key, Google
Play service account, Android upload
key (`rn-sandbox-upload.keystore`), `shared.env` (fastlane match settings and
other shared values), and `app.env` (this app's own, such as the upload key's
passwords, `ANDROID_KEYSTORE_STORE_PASS` and `ANDROID_KEYSTORE_KEY_PASS`, and
the Terraform state key), which wins over `shared.env`. The lanes import only
the values they need, and never override one already in the environment.
`NATIVE_RELEASE_SECRETS_DIR` names a folder for the lanes to use instead of
`.secrets/prod`.

One-time store setup that has no API:

- **Google Play:** a new app only accepts draft releases until its first release
  is rolled out by hand. Run
  `bundle exec fastlane android upload_release release_status:draft`, then in
  Play Console add testers to internal testing and roll the draft out. After
  that, `bun run android:upload-release` uploads each build and rolls it out to
  internal testers.
- **App Store:** add internal testers (App Store Connect users) to the
  `Internal` TestFlight group.
