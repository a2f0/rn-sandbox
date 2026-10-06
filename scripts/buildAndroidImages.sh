#!/bin/sh
set -e

# Build Android launcher icons from assets/icon.svg and assets/background.svg.
# Outputs are gitignored; the app's preBuild also runs this via Gradle.
# Requires: ImageMagick

# shellcheck source=scripts/lib/images.sh
. "$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)/lib/images.sh"
images_require_tools

RES_DIR="$IMAGES_REPO_ROOT/android/app/src/main/res"

echo "Generating Android images from assets/"

# density:scale-in-quarters (mdpi = 4/4, hdpi = 6/4, ...), keeping the math integral.
for entry in mdpi:4 hdpi:6 xhdpi:8 xxhdpi:12 xxxhdpi:16; do
  density=${entry%%:*}
  quarters=${entry#*:}
  dir="$RES_DIR/mipmap-$density"

  # Adaptive icon layers (Android 8+, see mipmap-anydpi-v26/): a 108dp canvas
  # whose inner 72dp is visible, which the mark fills. The themed layer is the
  # mark in a single color.
  layer=$((108 * quarters / 4))
  mark=$((72 * quarters / 4))
  render_background "$layer" "$dir/ic_launcher_background.png"
  render_mark "$layer" "$mark" "$dir/ic_launcher_foreground.png"
  render_mark "$layer" "$mark" "$dir/ic_launcher_monochrome.png" white

  # Legacy 48dp icons for Android 7.
  legacy=$((48 * quarters / 4))
  render_icon "$legacy" "$dir/ic_launcher.png"
  render_round_icon "$legacy" "$dir/ic_launcher_round.png"

  echo "  $density: adaptive layers (${layer}px), legacy icons (${legacy}px)"
done
