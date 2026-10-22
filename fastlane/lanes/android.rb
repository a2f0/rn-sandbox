# frozen_string_literal: true

require_relative '../lib/native_release_target'
require_relative '../lib/play_version_code'

ANDROID_DIR = File.join(NATIVE_APP_DIR, 'android')
ANDROID_KEYSTORE_PATH = File.join(NATIVE_RELEASE_SECRETS_DIR, 'rn-sandbox-upload.keystore')
ANDROID_RELEASE_AAB = File.join(ANDROID_DIR, 'app/build/outputs/bundle/release/app-release.aab')
GOOGLE_PLAY_JSON_KEY_PATH = File.join(NATIVE_RELEASE_SECRETS_DIR, 'google-play-service-account-admin.json')
GOOGLE_PLAY_TRACKS = %w[production beta alpha internal].freeze

# Only what the Android lanes need from .secrets: the upload key's passwords,
# which android/app/build.gradle reads from the environment.
ANDROID_SECRETS = %w[ANDROID_KEYSTORE_STORE_PASS ANDROID_KEYSTORE_KEY_PASS].freeze

def next_google_play_version_code
  missing = lambda do |source, error|
    UI.important("No version codes from #{source} (#{error.message.lines.first&.strip})")
  end
  PlayVersionCode.next_code(GOOGLE_PLAY_TRACKS, on_missing: missing) { |source| google_play_version_codes(source) }
end

# The version codes on a Google Play track, or on every uploaded bundle and APK.
def google_play_version_codes(source)
  return google_play_uploaded_version_codes if source == PlayVersionCode::UPLOADED

  google_play_track_version_codes(
    package_name: NATIVE_APP_IDENTIFIER, track: source, json_key: GOOGLE_PLAY_JSON_KEY_PATH
  )
end

# The version codes of every bundle and APK uploaded to Google Play, released
# or not. No fastlane action lists them, so this reads them through supply's
# client in an edit it then discards.
def google_play_uploaded_version_codes
  client = google_play_client
  client.begin_edit(package_name: NATIVE_APP_IDENTIFIER)
  begin
    (client.aab_version_codes + client.apks_version_codes).compact.map(&:to_i)
  ensure
    client.abort_current_edit
  end
end

def google_play_client
  require 'supply'
  require 'supply/options'
  Supply.config = FastlaneCore::Configuration.create(
    Supply::Options.available_options, package_name: NATIVE_APP_IDENTIFIER, json_key: GOOGLE_PLAY_JSON_KEY_PATH
  )
  Supply::Client.make_from_config
end

platform :android do
  desc 'Build the release App Bundle, signed with the upload key, without uploading it (build_number:)'
  lane :build_release do |options|
    load_store_secrets(ANDROID_SECRETS)
    ANDROID_SECRETS.each { |name| required_env(name) }
    UI.user_error!("Missing upload keystore: #{ANDROID_KEYSTORE_PATH}") unless File.file?(ANDROID_KEYSTORE_PATH)

    version_code = options[:build_number]&.to_i || next_google_play_version_code
    UI.message("Building #{NATIVE_APP_IDENTIFIER} version code #{version_code}")
    sh('sh', File.join(NATIVE_APP_DIR, 'scripts/ensureGradleWrapper.sh'))
    gradle(
      project_dir: ANDROID_DIR, task: 'bundleRelease',
      properties: {
        'rnSandboxVersionCode' => version_code, 'rnSandboxUploadSigning' => true,
        'rnSandboxUploadKeystore' => ANDROID_KEYSTORE_PATH
      },
      flags: '--console=plain'
    )
    UI.user_error!("App Bundle was not created: #{ANDROID_RELEASE_AAB}") unless File.file?(ANDROID_RELEASE_AAB)
    UI.success("App Bundle: #{ANDROID_RELEASE_AAB}")
    ANDROID_RELEASE_AAB
  end

  # Rolls the release out on the track, with no Play Console step. A new Play
  # app only accepts draft releases until its first release has been rolled out
  # by hand; pass release_status:draft to upload one without rolling it out.
  desc 'Build the release App Bundle and upload it to a Google Play track ' \
       '(build_number:, track: internal, release_status: completed)'
  lane :upload_release do |options|
    aab = build_release(options)
    upload_to_play_store(
      package_name: NATIVE_APP_IDENTIFIER, json_key: GOOGLE_PLAY_JSON_KEY_PATH, aab: aab,
      track: options.fetch(:track, 'internal'), release_status: options.fetch(:release_status, 'completed'),
      skip_upload_apk: true, skip_upload_metadata: true, skip_upload_changelogs: true,
      skip_upload_images: true, skip_upload_screenshots: true
    )
  end
end
