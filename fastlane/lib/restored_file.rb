# frozen_string_literal: true

# Puts a file's original contents back after the block, whether it succeeds or
# fails. The release lanes edit project.pbxproj signing settings only for the
# duration of a build.
module RestoredFile
  def self.around(path)
    original = File.read(path)
    yield
  ensure
    File.write(path, original) unless original.nil?
  end
end
