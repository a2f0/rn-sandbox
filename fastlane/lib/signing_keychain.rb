# frozen_string_literal: true

require 'securerandom'

# A throwaway keychain for the distribution certificate match installs, deleted
# when the block finishes, whether it succeeds or fails. create, delete, exists,
# path, and security (which runs the security tool and returns its output) are
# injected so the Fastfile can use fastlane actions and tests can record calls.
#
# While the block runs, the keychain comes first in the user's keychain search
# list, and the list is restored afterwards. codesign looks the signing identity
# up through that list even when given --keychain, and the login keychain can
# hold the same identity from an earlier match run. Where the login keychain is
# locked, as over SSH, codesign fails with errSecInternalComponent if it finds
# that copy first.
module SigningKeychain
  KEYCHAINS_DIR = File.join(Dir.home, 'Library', 'Keychains')

  def self.with_temporary(create:, delete:, security:, path:, exists: method(:exists?), prefix: 'rn-sandbox-fastlane')
    name = "#{prefix}-#{Process.pid}-#{SecureRandom.hex(4)}"
    password = SecureRandom.hex(32)
    search_list = search_list(security)
    begin
      create.call(name, password)
      set_search_list(security, [path.call(name), *search_list])
      yield name, password
    ensure
      begin
        set_search_list(security, search_list)
      ensure
        # Setup can fail before the keychain exists; deleting it then would mask that error.
        delete.call(name) if exists.call(name)
      end
    end
  end

  def self.search_list(security)
    security.call('list-keychains', '-d', 'user').scan(/"([^"]+)"/).flatten
  end

  def self.set_search_list(security, paths)
    security.call('list-keychains', '-d', 'user', '-s', *paths)
  end

  def self.exists?(name, keychains_dir: KEYCHAINS_DIR)
    base = File.join(keychains_dir, name)
    ["#{base}-db", "#{base}.keychain-db", base, "#{base}.keychain"].any? { |path| File.file?(path) }
  end
end
