# frozen_string_literal: true

# Stands in for the parts of fastlane_core the lanes and their helpers use.
module FastlaneCore
  class UserError < StandardError; end

  # Raises user errors as fastlane does, and drops other messages.
  module UI
    def self.user_error!(message) = raise(UserError, message)
    def self.message(_text) = nil
    def self.success(_text) = nil
    def self.important(_text) = nil
  end

  # Names keychains as fastlane does, under a fixed directory.
  module Helper
    def self.keychain_path(name) = "/keychains/#{name}-db"
  end
end
