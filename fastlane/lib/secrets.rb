# frozen_string_literal: true

require 'dotenv'

# .secrets is a gitignored symlink to this project's folder in matrix-secrets
# (see the README), and the lanes read its prod tier. RN_SANDBOX_SECRETS_DIR
# names another tier folder in place of .secrets/prod, as the lane tests do.
SECRETS_DIR = ENV.fetch('RN_SANDBOX_SECRETS_DIR') { File.expand_path('../../.secrets/prod', __dir__) }

# Loaded in order, so app.env (this project's own values) wins over shared.env
# (values copied from the shared root).
SECRETS_ENV_FILES = %w[shared.env app.env].freeze

# Only what each platform's lanes need.
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
ANDROID_SECRETS = %w[RN_SANDBOX_ANDROID_KEYSTORE_PASS].freeze

GOOGLE_PLAY_JSON_KEY_PATH = File.join(SECRETS_DIR, 'google-play-service-account-admin.json')

# Values already in the environment win, so any of them can be overridden.
def load_store_secrets(names)
  values = SECRETS_ENV_FILES.each_with_object({}) do |file, merged|
    path = File.join(SECRETS_DIR, file)
    UI.user_error!("Missing #{path}. Is the .secrets symlink set up?") unless File.file?(path)

    merged.merge!(Dotenv.parse(path))
  end
  names.each { |name| ENV[name] ||= values[name] if values.key?(name) }
end

def required_env(name)
  value = ENV.fetch(name, '')
  UI.user_error!("#{name} is required (from .secrets or the environment).") if value.empty?

  value
end

def app_store_connect_api_key_options
  key_id = required_env('APP_STORE_CONNECT_KEY_ID')
  key_filepath = File.join(SECRETS_DIR, "AuthKey_#{key_id}.p8")
  UI.user_error!("Missing App Store Connect API key: #{key_filepath}") unless File.file?(key_filepath)

  { key_id: key_id, issuer_id: required_env('APP_STORE_CONNECT_ISSUER_ID'), key_filepath: key_filepath }
end
