# frozen_string_literal: true

# Just enough of fastlane to evaluate fastlane/Fastfile and run its lanes with
# recording stand-ins for every action, so tests see what each lane passes
# without building, signing, or uploading anything. Needs only plain Ruby.

class UserError < StandardError; end

module UI
  def self.user_error!(message) = raise(UserError, message)
  def self.message(_text) = nil
  def self.success(_text) = nil
  def self.important(_text) = nil
end

module FastlaneCore
  module Helper
    def self.keychain_path(name) = "/keychains/#{name}-db"
  end
end

# create_app looks the new app up through Spaceship; tests set the finder.
module Spaceship
  module ConnectAPI
    class App
      class << self
        attr_accessor :finder

        def find(identifier) = finder.call(identifier)
      end
    end
  end
end

class FakeFastfile
  attr_reader :calls

  # stubs maps each action the lanes may call to a callable returning its result.
  def initialize(path, stubs)
    @stubs = stubs
    @calls = []
    @lanes = Hash.new { |lanes, platform| lanes[platform] = {} }
    instance_eval(File.read(path), path)
  end

  def run_lane(platform, name, options = {})
    previous = @platform
    @platform = platform
    @lanes.fetch(platform).fetch(name).call(options)
  ensure
    @platform = previous
  end

  def calls_to(action) = @calls.select { |name, _| name == action }.map(&:last)

  # Replaces a helper method the Fastfile defines.
  def stub_method(name, &) = define_singleton_method(name, &)

  # Repoints a constant the Fastfile defines, such as an output path.
  def set_constant(name, value)
    singleton_class.send(:remove_const, name)
    singleton_class.const_set(name, value)
  end

  private

  def default_platform(_platform) = nil
  def skip_docs = nil
  def desc(_text) = nil

  def platform(name)
    @defining = name
    yield
  ensure
    @defining = nil
  end

  def lane(name, &block)
    @lanes[@defining][name] = block
  end

  # Lanes call other lanes of their platform, and actions, by name.
  def method_missing(name, *args, **kwargs)
    return run_lane(@platform, name, *args) if @platform && @lanes[@platform].key?(name)
    return super unless @stubs.key?(name)

    @calls << [name, kwargs.empty? ? args : kwargs]
    @stubs.fetch(name).call(*args, **kwargs)
  end

  def respond_to_missing?(name, include_private = false) = @stubs.key?(name) || super
end
