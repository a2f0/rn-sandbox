# frozen_string_literal: true

require 'securerandom'

# A throwaway keychain for the distribution certificate match installs, deleted
# when the block finishes, whether it succeeds or fails. create, delete, and
# exists are injected so the Fastfile can use fastlane actions and tests can
# record calls.
module SigningKeychain
  def self.with_temporary(create:, delete:, exists: method(:exists?), prefix: 'rn-sandbox-fastlane')
    name = "#{prefix}-#{Process.pid}-#{SecureRandom.hex(4)}"
    password = SecureRandom.hex(32)
    begin
      create.call(name, password)
      yield name, password
    ensure
      # Setup can fail before the keychain exists; deleting it then would mask that error.
      delete.call(name) if exists.call(name)
    end
  end

  def self.exists?(name, keychains_dir: File.join(Dir.home, 'Library', 'Keychains'))
    base = File.join(keychains_dir, name)
    ["#{base}-db", "#{base}.keychain-db", base, "#{base}.keychain"].any? { |path| File.file?(path) }
  end
end
