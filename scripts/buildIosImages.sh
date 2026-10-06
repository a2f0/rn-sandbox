#!/bin/sh
set -e

# Build iOS image assets from assets/icon.svg and assets/background.svg.
# Outputs are gitignored; the app target also runs this as a build phase.
# Requires: ImageMagick

# shellcheck source=scripts/lib/images.sh
. "$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)/lib/images.sh"
images_require_tools

ASSETS_DIR="$IMAGES_REPO_ROOT/ios/sandbox/Images.xcassets"

echo "Generating iOS images from assets/"

render_icon 1024 "$ASSETS_DIR/AppIcon.appiconset/AppIcon.png"
echo "  AppIcon.png (1024x1024)"
