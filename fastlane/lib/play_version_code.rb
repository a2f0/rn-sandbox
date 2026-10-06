# frozen_string_literal: true

# Picks the next Google Play version code from the codes already on each track
# and on every bundle or APK ever uploaded. Play keeps an uploaded build's code
# even after it's dropped from a draft, so the tracks alone can miss one.
module PlayVersionCode
  UPLOADED = 'uploaded bundles'

  # Only a missing app or track counts as "no version codes yet". Any other
  # failure (auth, network) could hide the highest code and produce a duplicate.
  MISSING = /not found/i

  # Yields each track, then UPLOADED, to fetch their version codes, and calls
  # on_missing with the source and error when the app or track doesn't exist yet.
  def self.next_code(tracks, on_missing: ->(_source, _error) {})
    codes = [*tracks, UPLOADED].flat_map do |source|
      yield(source)
    rescue StandardError => e
      raise unless e.message.match?(MISSING)

      on_missing.call(source, e)
      []
    end
    (codes.map(&:to_i).max || 0) + 1
  end
end
