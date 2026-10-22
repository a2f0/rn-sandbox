# frozen_string_literal: true

# create_app looks the new app up through Spaceship, and register_identifiers
# the bundle ID; tests set the finders and see what was created.
module Spaceship
  module ConnectAPI
    module Platform
      IOS = 'IOS'
    end

    # An App Store Connect app, found through the finder a test sets.
    class App
      class << self
        attr_accessor :finder

        def find(identifier) = finder.call(identifier)
      end
    end

    # A bundle ID, found through the finder a test sets and recorded when
    # created.
    class BundleId
      class << self
        attr_accessor :finder, :created

        def find(identifier) = finder.call(identifier)
        def create(**args) = created.push(args).last
      end
    end
  end
end
