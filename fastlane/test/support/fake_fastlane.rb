# frozen_string_literal: true

require_relative 'fake_fastlane_core'
require_relative 'fake_spaceship'

# Just enough of fastlane to evaluate fastlane/Fastfile, the lane files it
# imports, and their lanes with recording stand-ins for every action, so tests
# see what each lane passes without building, signing, or uploading anything.
# Needs only plain Ruby.
class FakeFastfile
  # Lane files see UI, as fastlane's Fastlane::UI, but plain Ruby files they
  # require don't, so those must use FastlaneCore::UI as they do under fastlane.
  UI = FastlaneCore::UI

  attr_reader :calls

  # stubs maps each action the lanes may call to a callable returning its result.
  def initialize(path, stubs)
    @path = path
    @stubs = stubs
    @calls = []
    @lanes = Hash.new { |lanes, platform| lanes[platform] = {} }
    evaluate(path)
  end

  def run_lane(platform, name, options = {})
    previous = @platform
    @platform = platform
    @lanes.fetch(platform).fetch(name).call(options)
  ensure
    @platform = previous
  end

  def calls_to(action) = @calls.select { |name, _| name == action }.map(&:last)

  # Each platform's lane names, in the order they're defined.
  def lane_names = @lanes.transform_values(&:keys)

  # Replaces a helper method the lane files define.
  def stub_method(name, &) = define_singleton_method(name, &)

  # Repoints a constant the lane files define, such as an output path.
  def set_constant(name, value)
    singleton_class.send(:remove_const, name)
    singleton_class.const_set(name, value)
  end

  private

  def evaluate(path) = instance_eval(File.read(path), path)

  # As fastlane's import does, relative to the Fastfile.
  def import(path) = evaluate(File.expand_path(path, File.dirname(@path)))

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
