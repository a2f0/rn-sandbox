import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const fastlaneDir = resolve(__dirname, '..');

// Runs the Fastfile's lanes against fake actions (support/fake_fastlane.rb)
// and prints what each scenario recorded.
const script = `
require "json"
require "tmpdir"
require "fake_fastlane"

fastlane_dir = ARGV.fetch(0)
secrets = Dir.mktmpdir("rn-sandbox-secrets-")
work = Dir.mktmpdir("rn-sandbox-lanes-")
at_exit { [secrets, work].each { |dir| FileUtils.rm_rf(dir) } }

ENV["RN_SANDBOX_SECRETS_DIR"] = secrets
SECRET_NAMES = %w[APPLE_ID APP_STORE_CONNECT_ISSUER_ID APP_STORE_CONNECT_KEY_ID ITC_TEAM_ID
                  MATCH_GIT_BASIC_AUTHORIZATION MATCH_GIT_URL MATCH_PASSWORD TEAM_ID
                  RN_SANDBOX_ANDROID_KEYSTORE_PASS].freeze
KEYSTORE = File.join(secrets, "rn-sandbox-upload.keystore")
PROFILE_ENV = "sigh_net.a2f0.sandbox.rn_appstore_profile-name"

def write_secrets(secrets, android_password: true, keystore: true)
  SECRET_NAMES.each { |name| ENV.delete(name) }
  ENV.delete(PROFILE_ENV)
  File.write(File.join(secrets, "root.env"), <<~ENV)
    export APPLE_ID=developer@example.com
    export ITC_TEAM_ID=ITC123
    export APP_STORE_CONNECT_ISSUER_ID=issuer
    export APP_STORE_CONNECT_KEY_ID=KEY123
    export TEAM_ID=TEAM123
    UNRELATED=ignored
  ENV
  File.write(File.join(secrets, "AuthKey_KEY123.p8"), "key")
  File.write(File.join(secrets, "rn-sandbox.env"), android_password ? "RN_SANDBOX_ANDROID_KEYSTORE_PASS=upload-pass\\n" : "")
  keystore ? File.write(KEYSTORE, "keystore") : FileUtils.rm_f(KEYSTORE)
end

def error_of
  yield
  nil
rescue StandardError => e
  e.message
end

# Android: tracks hold 3, and an upload dropped from a draft holds 9.
def android(work, create_bundle: true)
  aab = File.join(work, "app-release.aab")
  FileUtils.rm_f(aab)
  track_codes = { "production" => [], "beta" => [], "alpha" => [], "internal" => [3] }
  password = nil
  fastfile = FakeFastfile.new(File.join(ARGV.fetch(0), "Fastfile"),
    google_play_track_version_codes: ->(track:, **) { track_codes.fetch(track) },
    sh: ->(*) {},
    gradle: lambda do |**|
      password = ENV["RN_SANDBOX_ANDROID_KEYSTORE_PASS"]
      File.write(aab, "bundle") if create_bundle
    end,
    upload_to_play_store: ->(**) {})
  fastfile.stub_method(:google_play_uploaded_version_codes) { [9] }
  fastfile.set_constant(:ANDROID_RELEASE_AAB, aab)
  [fastfile, aab, -> { password }]
end

# The security tool, as far as the keychain search list goes.
def fake_security
  search_list = ["/keychains/login.keychain-db"]
  sh = lambda do |*args, **|
    search_list = args.drop(args.index("-s") + 1) if args.include?("-s")
    search_list.map { |path| "    \\"#{path}\\"\\n" }.join
  end
  [sh, -> { search_list }]
end

# iOS: TestFlight's latest build is 41; match names the profile as it does.
def ios(work, fail_build: false)
  project = File.join(work, "sandbox.xcodeproj")
  pbxproj = File.join(project, "project.pbxproj")
  FileUtils.mkdir_p(project)
  File.write(pbxproj, "original")
  during_build = nil
  search_during_build = nil
  security, search_list = fake_security
  fastfile = FakeFastfile.new(File.join(ARGV.fetch(0), "Fastfile"),
    app_store_connect_api_key: ->(**) { "api-key" },
    latest_testflight_build_number: ->(**) { 41 },
    cocoapods: ->(**) {},
    create_keychain: ->(**) {},
    delete_keychain: ->(**) {},
    sh: security,
    match: ->(**) { ENV[PROFILE_ENV] = "match AppStore net.a2f0.sandbox.rn" },
    update_code_signing_settings: ->(path:, **) { File.write(File.join(path, "project.pbxproj"), "signed") },
    build_app: lambda do |**|
      during_build = File.read(pbxproj)
      search_during_build = search_list.call
      raise "archive failed" if fail_build

      "/out/RNSandbox.ipa"
    end,
    upload_to_testflight: ->(**) {})
  fastfile.set_constant(:IOS_PROJECT, project)
  project_and_search = lambda do
    { during_build: during_build, after: File.read(pbxproj),
      search_during_build: search_during_build, search_after: search_list.call }
  end
  [fastfile, project_and_search]
end

# A stand-in for the App Store Connect app, recording TestFlight group calls.
class FakeApp
  attr_reader :calls

  def initialize(groups) = (@groups = groups) && (@calls = [])

  def get_beta_groups(filter:)
    @calls << [:get_beta_groups, filter]
    @groups
  end

  def create_beta_group(**args)
    @calls << [:create_beta_group, args]
  end
end

def create_app(app)
  Spaceship::ConnectAPI::App.finder = ->(_identifier) { app }
  FakeFastfile.new(File.join(ARGV.fetch(0), "Fastfile"),
    produce: ->(**) {}, app_store_connect_api_key: ->(**) { "api-key" },
    create_keychain: ->(**) {}, delete_keychain: ->(**) {}, match: ->(**) {}, sh: fake_security.first)
end

def run_profiles(options = {})
  fastfile = FakeFastfile.new(File.join(ARGV.fetch(0), "Fastfile"),
    app_store_connect_api_key: ->(**) { "api-key" },
    create_keychain: ->(**) {}, delete_keychain: ->(**) {}, match: ->(**) {}, sh: fake_security.first)
  fastfile.run_lane(:ios, :profiles, options)
  { match: fastfile.calls_to(:match), keychain: fastfile.calls_to(:create_keychain).first&.fetch(:name) }
end

def run_register_identifiers(existing)
  Spaceship::ConnectAPI::BundleId.finder = ->(_identifier) { existing }
  Spaceship::ConnectAPI::BundleId.created = []
  fastfile = FakeFastfile.new(File.join(ARGV.fetch(0), "Fastfile"), app_store_connect_api_key: ->(**) { "api-key" })
  fastfile.run_lane(:ios, :register_identifiers)
  { api_key: fastfile.calls_to(:app_store_connect_api_key), created: Spaceship::ConnectAPI::BundleId.created }
end

def create_app_result(fastfile, app)
  { error: error_of { fastfile.run_lane(:ios, :create_app) },
    produce: fastfile.calls_to(:produce), match: fastfile.calls_to(:match),
    keychain: fastfile.calls_to(:create_keychain).first&.fetch(:name), groups: app&.calls }
end

results = { keystore: KEYSTORE }

write_secrets(secrets)
app = FakeApp.new([])
results[:create_app] = create_app_result(create_app(app), app)

write_secrets(secrets)
app = FakeApp.new([:existing])
results[:create_app_existing_group] = create_app_result(create_app(app), app)

write_secrets(secrets)
results[:create_app_missing_app] = create_app_result(create_app(nil), nil)

write_secrets(secrets)
File.write(File.join(secrets, "root.env"), File.read(File.join(secrets, "root.env")).sub(/^export APPLE_ID=.*\n/, ""))
app = FakeApp.new([])
results[:create_app_no_apple_id] = create_app_result(create_app(app), app)

write_secrets(secrets)
results[:profiles] = run_profiles

write_secrets(secrets)
results[:profiles_force] = run_profiles({ force: "true" })

write_secrets(secrets)
results[:register_identifiers] = run_register_identifiers(nil)

write_secrets(secrets)
results[:register_identifiers_existing] = run_register_identifiers(:existing)

write_secrets(secrets)
fastfile, aab, password = android(work)
results[:android_build] = {
  result: fastfile.run_lane(:android, :build_release) == aab,
  gradle: fastfile.calls_to(:gradle), sh: fastfile.calls_to(:sh), password: password.call
}

fastfile, = android(work)
fastfile.run_lane(:android, :build_release, { version_code: "42" })
results[:android_override] = {
  gradle: fastfile.calls_to(:gradle), track_lookups: fastfile.calls_to(:google_play_track_version_codes).length
}

write_secrets(secrets, keystore: false)
fastfile, = android(work)
results[:android_no_keystore] = { error: error_of { fastfile.run_lane(:android, :build_release) }, gradle: fastfile.calls_to(:gradle).length }

write_secrets(secrets, android_password: false)
fastfile, = android(work)
results[:android_no_password] = { error: error_of { fastfile.run_lane(:android, :build_release) }, gradle: fastfile.calls_to(:gradle).length }

write_secrets(secrets)
fastfile, = android(work, create_bundle: false)
results[:android_no_bundle] = { error: error_of { fastfile.run_lane(:android, :build_release) } }

fastfile, aab = android(work)
fastfile.run_lane(:android, :internal)
results[:android_internal] = { upload: fastfile.calls_to(:upload_to_play_store), aab: aab }

fastfile, = android(work)
fastfile.run_lane(:android, :internal, { release_status: "draft" })
results[:android_internal_draft] = { upload: fastfile.calls_to(:upload_to_play_store) }

write_secrets(secrets)
fastfile, project = ios(work)
result = fastfile.run_lane(:ios, :build_release)
keychain = fastfile.calls_to(:create_keychain).first&.fetch(:name)
results[:ios_build] = {
  result: result, keychain: keychain, project: project.call,
  pods: fastfile.calls_to(:cocoapods).length,
  match: fastfile.calls_to(:match), signing: fastfile.calls_to(:update_code_signing_settings),
  build: fastfile.calls_to(:build_app)
}

write_secrets(secrets)
fastfile, = ios(work)
fastfile.run_lane(:ios, :build_release, { build_number: "7" })
results[:ios_override] = {
  xcargs: fastfile.calls_to(:build_app).first&.fetch(:xcargs),
  latest_lookups: fastfile.calls_to(:latest_testflight_build_number).length
}

write_secrets(secrets)
fastfile, project = ios(work, fail_build: true)
results[:ios_failed_build] = { error: error_of { fastfile.run_lane(:ios, :build_release) }, project: project.call }

write_secrets(secrets)
fastfile, = ios(work)
fastfile.run_lane(:ios, :beta)
results[:ios_beta] = { upload: fastfile.calls_to(:upload_to_testflight) }

puts JSON.generate(results)
`;

const results = (() => {
  const child = spawnSync(
    'ruby',
    ['-I', resolve(__dirname, 'support'), '-e', script, fastlaneDir],
    { encoding: 'utf8' },
  );
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(`ruby exited with ${child.status}: ${child.stderr}`);
  }
  return JSON.parse(child.stdout);
})();

const repoRoot = resolve(fastlaneDir, '..');

describe('android lanes', () => {
  test('build_release signs with the upload key at the next version code', () => {
    expect(results.android_build).toEqual({
      result: true,
      gradle: [
        {
          project_dir: `${repoRoot}/android`,
          task: 'bundleRelease',
          properties: {
            rnSandboxVersionCode: 10,
            rnSandboxUploadSigning: true,
            rnSandboxUploadKeystore: results.keystore,
          },
          flags: '--console=plain',
        },
      ],
      sh: [['sh', `${repoRoot}/scripts/ensureGradleWrapper.sh`]],
      password: 'upload-pass',
    });
  });

  test('build_release takes a version code override', () => {
    expect(results.android_override.gradle[0].properties).toEqual({
      rnSandboxVersionCode: 42,
      rnSandboxUploadSigning: true,
      rnSandboxUploadKeystore: results.keystore,
    });
    expect(results.android_override.track_lookups).toBe(0);
  });

  test('build_release stops without the upload key or a bundle', () => {
    expect(results.android_no_keystore).toEqual({
      error: expect.stringContaining('Missing upload keystore'),
      gradle: 0,
    });
    expect(results.android_no_password).toEqual({
      error: expect.stringContaining('RN_SANDBOX_ANDROID_KEYSTORE_PASS'),
      gradle: 0,
    });
    expect(results.android_no_bundle.error).toContain(
      'App Bundle was not created',
    );
  });

  test('internal rolls the bundle out to internal testers', () => {
    const { upload, aab } = results.android_internal;
    expect(upload).toEqual([
      {
        package_name: 'net.a2f0.sandbox.rn',
        json_key: expect.stringMatching(
          /google-play-service-account-admin\.json$/,
        ),
        aab,
        track: 'internal',
        release_status: 'completed',
        skip_upload_apk: true,
        skip_upload_metadata: true,
        skip_upload_changelogs: true,
        skip_upload_images: true,
        skip_upload_screenshots: true,
      },
    ]);
    expect(results.android_internal_draft.upload[0].release_status).toBe(
      'draft',
    );
  });
});

describe('ios lanes', () => {
  test('build_release signs with the match profile in a temporary keychain', () => {
    const { keychain, build, match, signing } = results.ios_build;
    expect(results.ios_build.result).toBe('/out/RNSandbox.ipa');
    expect(results.ios_build.pods).toBe(1);
    expect(keychain).toMatch(/^rn-sandbox-fastlane-/);
    expect(match).toEqual([
      {
        type: 'appstore',
        app_identifier: 'net.a2f0.sandbox.rn',
        api_key: 'api-key',
        readonly: true,
        keychain_name: keychain,
        keychain_password: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ]);
    expect(signing).toEqual([
      expect.objectContaining({
        use_automatic_signing: false,
        team_id: 'TEAM123',
        code_sign_identity: 'Apple Distribution',
        profile_name: 'match AppStore net.a2f0.sandbox.rn',
        targets: ['sandbox'],
        build_configurations: ['Release'],
      }),
    ]);
    expect(build).toEqual([
      expect.objectContaining({
        workspace: `${repoRoot}/ios/sandbox.xcworkspace`,
        scheme: 'sandbox',
        configuration: 'Release',
        export_method: 'app-store',
        export_options: expect.objectContaining({
          signingStyle: 'manual',
          teamID: 'TEAM123',
          provisioningProfiles: {
            'net.a2f0.sandbox.rn': 'match AppStore net.a2f0.sandbox.rn',
          },
        }),
        xcargs: `CURRENT_PROJECT_VERSION=42 DEVELOPMENT_TEAM=TEAM123 OTHER_CODE_SIGN_FLAGS=--keychain\\ /keychains/${keychain}-db`,
      }),
    ]);
    // Manual signing applies, and the signing keychain is searched first,
    // only while the archive builds.
    expect(results.ios_build.project).toEqual({
      during_build: 'signed',
      after: 'original',
      search_during_build: [
        `/keychains/${keychain}-db`,
        '/keychains/login.keychain-db',
      ],
      search_after: ['/keychains/login.keychain-db'],
    });
  });

  test('build_release takes a build number override', () => {
    expect(results.ios_override.xcargs).toMatch(/^CURRENT_PROJECT_VERSION=7 /);
    expect(results.ios_override.latest_lookups).toBe(0);
  });

  test('build_release restores the project and search list when the archive fails', () => {
    expect(results.ios_failed_build).toEqual({
      error: 'archive failed',
      project: {
        during_build: 'signed',
        after: 'original',
        search_during_build: [
          expect.stringMatching(/^\/keychains\/rn-sandbox-fastlane-.+-db$/),
          '/keychains/login.keychain-db',
        ],
        search_after: ['/keychains/login.keychain-db'],
      },
    });
  });

  test('beta uploads the build to TestFlight without waiting', () => {
    expect(results.ios_beta.upload).toEqual([
      {
        api_key: 'api-key',
        app_identifier: 'net.a2f0.sandbox.rn',
        ipa: '/out/RNSandbox.ipa',
        skip_submission: true,
        skip_waiting_for_build_processing: true,
      },
    ]);
  });

  test('create_app creates the app, an Internal TestFlight group, and the profile', () => {
    const { keychain, ...result } = results.create_app;
    expect(keychain).toMatch(/^rn-sandbox-fastlane-/);
    expect(result).toEqual({
      error: null,
      produce: [
        {
          username: 'developer@example.com',
          team_id: 'TEAM123',
          itc_team_id: 'ITC123',
          app_identifier: 'net.a2f0.sandbox.rn',
          app_name: 'RN Sandbox',
          sku: 'rn-sandbox',
          language: 'en-US',
          platforms: ['ios'],
        },
      ],
      groups: [
        ['get_beta_groups', { name: 'Internal' }],
        [
          'create_beta_group',
          {
            group_name: 'Internal',
            is_internal_group: true,
            has_access_to_all_builds: true,
          },
        ],
      ],
      match: [
        {
          type: 'appstore',
          app_identifier: 'net.a2f0.sandbox.rn',
          api_key: 'api-key',
          readonly: false,
          force: false,
          keychain_name: keychain,
          keychain_password: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
    });
  });

  test('profiles creates or renews the profile with the API key in a temporary keychain', () => {
    const { keychain, ...result } = results.profiles;
    expect(keychain).toMatch(/^rn-sandbox-fastlane-/);
    expect(result).toEqual({
      match: [
        {
          type: 'appstore',
          app_identifier: 'net.a2f0.sandbox.rn',
          api_key: 'api-key',
          readonly: false,
          force: false,
          keychain_name: keychain,
          keychain_password: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
    });
  });

  test('profiles regenerates the profile with force:true', () => {
    expect(results.profiles_force.match).toEqual([
      expect.objectContaining({ readonly: false, force: true }),
    ]);
  });

  test('register_identifiers registers a missing bundle ID with the API key', () => {
    expect(results.register_identifiers).toEqual({
      api_key: [
        {
          key_id: 'KEY123',
          issuer_id: 'issuer',
          key_filepath: expect.stringMatching(/AuthKey_KEY123\.p8$/),
        },
      ],
      created: [
        {
          name: 'RN Sandbox',
          platform: 'IOS',
          identifier: 'net.a2f0.sandbox.rn',
        },
      ],
    });
    expect(results.register_identifiers_existing.created).toEqual([]);
  });

  test('create_app keeps an existing Internal group', () => {
    expect(results.create_app_existing_group.groups).toEqual([
      ['get_beta_groups', { name: 'Internal' }],
    ]);
    expect(results.create_app_existing_group.match).toHaveLength(1);
  });

  test('create_app stops before signing when setup fails', () => {
    expect(results.create_app_missing_app).toMatchObject({
      error: 'No App Store Connect app for net.a2f0.sandbox.rn',
      match: [],
    });
    expect(results.create_app_missing_app.produce).toHaveLength(1);
    expect(results.create_app_no_apple_id).toMatchObject({
      error: expect.stringContaining('APPLE_ID is required'),
      produce: [],
      match: [],
      groups: [],
    });
  });
});
