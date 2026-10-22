# frozen_string_literal: true

# Evaluates fastlane/Appfile as fastlane's CredentialsManager::AppfileConfig
# does: from the Appfile's directory, with no file path for require_relative,
# and records the values it sets.
class FakeAppfile
  attr_reader :values

  def initialize(path)
    @values = {}
    Dir.chdir(File.dirname(path)) { instance_eval(File.read(path)) }
  end

  private

  def app_identifier(value) = @values[:app_identifier] = value
  def package_name(value) = @values[:package_name] = value
end
