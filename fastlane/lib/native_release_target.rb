# frozen_string_literal: true

require 'dotenv'

# What each release tier builds, keyed by NATIVE_RELEASE_TIER. rn-sandbox has
# only a production app.
NATIVE_RELEASE_TARGETS = {
  'production' => {
    app_identifier: 'net.a2f0.sandbox.rn',
    secrets_tier: 'prod'
  }.freeze
}.freeze

# The Appfile reads the selected app identifier before any lane runs, so the
# tier comes from the environment rather than a lane option.
NATIVE_RELEASE_TIER = ENV.fetch('NATIVE_RELEASE_TIER', 'production')
NATIVE_RELEASE_TARGET = NATIVE_RELEASE_TARGETS.fetch(NATIVE_RELEASE_TIER) do
  FastlaneCore::UI.user_error!(
    "Unknown NATIVE_RELEASE_TIER #{NATIVE_RELEASE_TIER.inspect}. " \
    "Declared tiers: #{NATIVE_RELEASE_TARGETS.keys.join(', ')}."
  )
end
NATIVE_APP_IDENTIFIER = NATIVE_RELEASE_TARGET.fetch(:app_identifier)

# The directory that holds ios/ and android/: the repository root.
NATIVE_APP_DIR = File.expand_path('../..', __dir__)

# .secrets is a gitignored symlink to this project's folder in matrix-secrets
# (see the README), and the lanes read the selected tier's folder in it.
# NATIVE_RELEASE_SECRETS_DIR names another folder in its place, as the lane
# tests do.
NATIVE_RELEASE_SECRETS_DIR = ENV.fetch('NATIVE_RELEASE_SECRETS_DIR') do
  File.join(NATIVE_APP_DIR, '.secrets', NATIVE_RELEASE_TARGET.fetch(:secrets_tier))
end

# Loaded in order, so app.env (this project's own values) wins over shared.env
# (values copied from the shared root).
NATIVE_RELEASE_SECRETS_ENV_FILES = %w[shared.env app.env].freeze

# Imports only the given names, since both files also hold values the lanes
# don't use. Values already in the environment win, so any of them can be
# overridden.
def load_store_secrets(names)
  values = NATIVE_RELEASE_SECRETS_ENV_FILES.each_with_object({}) do |file, merged|
    path = File.join(NATIVE_RELEASE_SECRETS_DIR, file)
    FastlaneCore::UI.user_error!("Missing #{path}. Is the .secrets symlink set up?") unless File.file?(path)

    merged.merge!(Dotenv.parse(path))
  end
  names.each { |name| ENV[name] ||= values[name] if values.key?(name) }
end

def required_env(name)
  value = ENV.fetch(name, '')
  FastlaneCore::UI.user_error!("#{name} is required (from .secrets or the environment).") if value.empty?

  value
end
