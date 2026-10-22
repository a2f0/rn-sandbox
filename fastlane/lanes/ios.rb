# frozen_string_literal: true

require 'shellwords'
require_relative '../lib/ios_signing_keychain'
require_relative '../lib/native_release_target'
require_relative '../lib/restored_file'

IOS_APP_NAME = 'RN Sandbox'
IOS_APP_SKU = 'rn-sandbox'
IOS_DIR = File.join(NATIVE_APP_DIR, 'ios')
IOS_PROJECT = File.join(IOS_DIR, 'sandbox.xcodeproj')
IOS_WORKSPACE = File.join(IOS_DIR, 'sandbox.xcworkspace')
IOS_SCHEME = 'sandbox'
IOS_TARGET = 'sandbox'
IOS_OUTPUT_DIR = File.join(IOS_DIR, 'build/release')
IOS_IPA_NAME = 'RNSandbox.ipa'
TESTFLIGHT_INTERNAL_GROUP = 'Internal'

# Only what the iOS lanes need from .secrets.
IOS_SECRETS = %w[
  APPLE_ID
  APP_STORE_CONNECT_ISSUER_ID
  APP_STORE_CONNECT_KEY_ID
  ITC_TEAM_ID
  MATCH_GIT_BASIC_AUTHORIZATION
  MATCH_GIT_URL
  MATCH_PASSWORD
  TEAM_ID
].freeze

def app_store_connect_api_key_options
  key_id = required_env('APP_STORE_CONNECT_KEY_ID')
  key_filepath = File.join(NATIVE_RELEASE_SECRETS_DIR, "AuthKey_#{key_id}.p8")
  UI.user_error!("Missing App Store Connect API key: #{key_filepath}") unless File.file?(key_filepath)

  { key_id: key_id, issuer_id: required_env('APP_STORE_CONNECT_ISSUER_ID'), key_filepath: key_filepath }
end

# match installs the distribution certificate into a throwaway keychain, not
# the login keychain, so nothing prompts for a keychain password or outlives
# the lane. IosSigningKeychain puts it first in the keychain search list, ahead
# of any copy of the identity in a login keychain that's locked, as over SSH.
# The app has no nested targets, so codesign only needs to be pointed at it
# (ios_build_xcargs); the default keychain stays as it is.
IOS_SIGNING_KEYCHAIN_OPTIONS = {
  default_keychain: false, unlock: true, timeout: 0, lock_when_sleeps: true,
  add_to_search_list: false, require_create: true
}.freeze

def with_signing_keychain(&)
  IosSigningKeychain.with_temporary(
    create: ->(name, password) { create_keychain(name: name, password: password, **IOS_SIGNING_KEYCHAIN_OPTIONS) },
    delete: ->(name) { delete_keychain(name: name) },
    security: ->(*args) { sh('security', *args, log: false) },
    path: ->(name) { FastlaneCore::Helper.keychain_path(name) }, &
  )
end

def ios_build_xcargs(build_number, team_id, keychain_name)
  keychain_path = FastlaneCore::Helper.keychain_path(keychain_name)
  [
    "CURRENT_PROJECT_VERSION=#{build_number}",
    "DEVELOPMENT_TEAM=#{team_id}",
    "OTHER_CODE_SIGN_FLAGS=#{Shellwords.escape("--keychain #{keychain_path}")}"
  ].join(' ')
end

# Pins manual App Store signing on the app target's Release configuration for
# the duration of the block, then restores the project file.
def with_manual_ios_signing(team_id, profile_name)
  RestoredFile.around(File.join(IOS_PROJECT, 'project.pbxproj')) do
    update_code_signing_settings(
      path: IOS_PROJECT, use_automatic_signing: false, team_id: team_id,
      code_sign_identity: 'Apple Distribution', profile_name: profile_name,
      targets: [IOS_TARGET], build_configurations: ['Release']
    )
    yield
  end
end

platform :ios do
  desc 'Register the bundle ID (App Store Connect API key)'
  lane :register_identifiers do
    load_store_secrets(IOS_SECRETS)
    app_store_connect_api_key(**app_store_connect_api_key_options)
    Spaceship::ConnectAPI::BundleId.find(NATIVE_APP_IDENTIFIER) ||
      Spaceship::ConnectAPI::BundleId.create(
        name: IOS_APP_NAME, platform: Spaceship::ConnectAPI::Platform::IOS, identifier: NATIVE_APP_IDENTIFIER
      )
    UI.success("#{NATIVE_APP_IDENTIFIER}: registered")
  end

  # match keeps the App Store profile in the encrypted certificates repo
  # (MATCH_GIT_URL), where build_release installs it from. This creates the
  # profile when it's missing or no longer valid; force:true regenerates it, as
  # after the bundle ID's capabilities or the distribution certificate change.
  desc 'Create or renew the match App Store profile (App Store Connect API key; force:true regenerates it)'
  lane :profiles do |options|
    load_store_secrets(IOS_SECRETS)
    api_key = app_store_connect_api_key(**app_store_connect_api_key_options)
    with_signing_keychain do |keychain_name, keychain_password|
      match(
        type: 'appstore', app_identifier: NATIVE_APP_IDENTIFIER, api_key: api_key, readonly: false,
        force: options[:force].to_s == 'true', keychain_name: keychain_name, keychain_password: keychain_password
      )
    end
  end

  # Apple has no API for creating App Store Connect apps, so this lane logs in
  # with your Apple ID (APPLE_ID) and may ask for a 2FA code. Run it once, in a
  # terminal.
  desc 'Create the bundle ID, App Store Connect app, TestFlight group, and App Store profile (Apple ID login)'
  lane :create_app do
    load_store_secrets(IOS_SECRETS)
    username = required_env('APPLE_ID')
    team_id = required_env('TEAM_ID')

    produce(
      username: username, team_id: team_id, itc_team_id: ENV.fetch('ITC_TEAM_ID', nil),
      app_identifier: NATIVE_APP_IDENTIFIER, app_name: IOS_APP_NAME, sku: IOS_APP_SKU, language: 'en-US',
      platforms: ['ios']
    )

    # Internal testers in this group get every build once it's processed.
    app = Spaceship::ConnectAPI::App.find(NATIVE_APP_IDENTIFIER)
    UI.user_error!("No App Store Connect app for #{NATIVE_APP_IDENTIFIER}") unless app
    if app.get_beta_groups(filter: { name: TESTFLIGHT_INTERNAL_GROUP }).empty?
      app.create_beta_group(group_name: TESTFLIGHT_INTERNAL_GROUP, is_internal_group: true,
                            has_access_to_all_builds: true)
    end
    UI.success("TestFlight group: #{TESTFLIGHT_INTERNAL_GROUP} (add internal testers in App Store Connect)")

    profiles
  end

  desc 'Build the App Store IPA, signed with the match profile, without uploading it (build_number:)'
  lane :build_release do |options|
    load_store_secrets(IOS_SECRETS)
    team_id = required_env('TEAM_ID')
    api_key = app_store_connect_api_key(**app_store_connect_api_key_options)
    build_number = options[:build_number]&.to_i ||
                   (latest_testflight_build_number(
                     api_key: api_key, app_identifier: NATIVE_APP_IDENTIFIER, initial_build_number: 0
                   ).to_i + 1)
    UI.message("Building #{NATIVE_APP_IDENTIFIER} build #{build_number}")

    cocoapods(podfile: File.join(IOS_DIR, 'Podfile'))
    with_signing_keychain do |keychain_name, keychain_password|
      match(
        type: 'appstore', app_identifier: NATIVE_APP_IDENTIFIER, api_key: api_key, readonly: true,
        keychain_name: keychain_name, keychain_password: keychain_password
      )
      profile_name = ENV.fetch("sigh_#{NATIVE_APP_IDENTIFIER}_appstore_profile-name")
      with_manual_ios_signing(team_id, profile_name) do
        build_app(
          workspace: IOS_WORKSPACE, scheme: IOS_SCHEME, configuration: 'Release', clean: true,
          export_method: 'app-store',
          export_options: {
            method: 'app-store', signingStyle: 'manual', teamID: team_id,
            provisioningProfiles: { NATIVE_APP_IDENTIFIER => profile_name },
            manageAppVersionAndBuildNumber: false, uploadSymbols: true
          },
          output_directory: IOS_OUTPUT_DIR, output_name: IOS_IPA_NAME,
          xcargs: ios_build_xcargs(build_number, team_id, keychain_name)
        )
      end
    end
  end

  # Doesn't wait for processing; the Internal group gets the build when it's done.
  desc 'Build the App Store IPA and upload it to TestFlight (build_number:)'
  lane :upload_release do |options|
    ipa = build_release(options)
    upload_to_testflight(
      api_key: app_store_connect_api_key(**app_store_connect_api_key_options),
      app_identifier: NATIVE_APP_IDENTIFIER, ipa: ipa,
      skip_submission: true, skip_waiting_for_build_processing: true
    )
  end
end
