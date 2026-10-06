# shellcheck shell=sh
# Shared helpers for building image assets from the SVGs in assets/. Sourced by
# scripts/buildIosImages.sh and scripts/buildAndroidImages.sh.
#
# Requires: ImageMagick (7's `magick`, or 6's `convert` as on Ubuntu). Optional:
# librsvg (`rsvg-convert`), which renders SVG features ImageMagick's built-in
# renderer can't, such as gradients.

IMAGES_REPO_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)"
ICON_SVG="$IMAGES_REPO_ROOT/assets/icon.svg"
BACKGROUND_SVG="$IMAGES_REPO_ROOT/assets/background.svg"

# Leaves out the PNG timestamps, so identical images come out byte for byte the
# same.
PNG_NO_TIMES="png:exclude-chunks=date,time"

# Xcode and Android Studio run builds with a minimal PATH.
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
export PATH

images_require_tools() {
  if command -v magick >/dev/null 2>&1; then
    MAGICK=magick
  elif command -v convert >/dev/null 2>&1; then
    MAGICK=convert
  else
    echo "Error: ImageMagick is required to build images (brew install imagemagick)." >&2
    exit 1
  fi
  for svg in "$ICON_SVG" "$BACKGROUND_SVG"; do
    if [ ! -f "$svg" ]; then
      echo "Error: source SVG not found at $svg" >&2
      exit 1
    fi
    # ImageMagick's built-in SVG renderer silently draws these wrong (gradients
    # come out black, strokes and transforms are dropped), so they need
    # librsvg's renderer.
    if ! command -v rsvg-convert >/dev/null 2>&1 &&
      grep -qE '<(linearGradient|radialGradient|filter|mask|clipPath|pattern|text|image)[ >]|stroke=|transform=' "$svg"; then
      echo "Error: $svg uses SVG features ImageMagick can't render. Install librsvg (brew install librsvg)." >&2
      exit 1
    fi
  done
  IMAGES_TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/images.XXXXXX")
  trap 'rm -rf "$IMAGES_TMP_DIR"' EXIT
  trap 'exit 1' HUP INT TERM
}

# Width of an SVG's viewBox, used to pick a render density so the vector is
# rasterized at (at least) the target size rather than scaled up.
svg_viewbox_width() {
  sed -n 's/.*viewBox="[^ ]* [^ ]* \([0-9.]*\) [0-9.]*".*/\1/p' "$1" | head -n 1
}

# rasterize <svg> <pixels> -> path of a transparent square PNG
# Uses librsvg when available (full SVG support), else ImageMagick's renderer.
rasterize() {
  svg=$1
  pixels=$2
  output="$IMAGES_TMP_DIR/$(basename "$svg" .svg)-$pixels.png"
  if [ ! -f "$output" ]; then
    if command -v rsvg-convert >/dev/null 2>&1; then
      rsvg-convert --width "$pixels" --height "$pixels" --keep-aspect-ratio \
        --output "$output" "$svg"
    else
      density=$(awk -v px="$pixels" -v w="$(svg_viewbox_width "$svg")" 'BEGIN { printf "%d", (px * 72 / w) + 1 }')
      # PNG32 keeps RGB even for an all-gray render, so later composites keep color.
      "$MAGICK" -background none -density "$density" "$svg" -resize "${pixels}x${pixels}" "PNG32:$output"
    fi
  fi
  printf '%s\n' "$output"
}

# render_mark <size> <mark-pixels> <output> [fill-color]
# The mark centered on a transparent square canvas. With a fill color, every
# opaque pixel is recolored (for monochrome icons).
render_mark() {
  size=$1
  mark=$2
  output=$3
  color=${4:-}
  mkdir -p "$(dirname "$output")"
  set -- "$(rasterize "$ICON_SVG" "$mark")" -background none -gravity center -extent "${size}x${size}"
  if [ -n "$color" ]; then
    set -- "$@" -fill "$color" -colorize 100
  fi
  "$MAGICK" "$@" -depth 8 -colorspace sRGB -type TrueColorAlpha -define "$PNG_NO_TIMES" "$output"
}

# render_background <size> <output>
# The background scaled to cover a square canvas. Opaque.
render_background() {
  size=$1
  output=$2
  mkdir -p "$(dirname "$output")"
  "$MAGICK" "$(rasterize "$BACKGROUND_SVG" "$size")" \
    -resize "${size}x${size}^" -gravity center -extent "${size}x${size}" \
    -background white -alpha remove -alpha off \
    -depth 8 -colorspace sRGB -type TrueColor -define png:color-type=2 -define "$PNG_NO_TIMES" "$output"
}

# render_icon <size> <output>
# The mark drawn over the background. Opaque, as App Store icons must be.
render_icon() {
  size=$1
  output=$2
  mkdir -p "$(dirname "$output")"
  "$MAGICK" "$(rasterize "$BACKGROUND_SVG" "$size")" "$(rasterize "$ICON_SVG" "$size")" \
    -gravity center -composite \
    -background white -alpha remove -alpha off \
    -depth 8 -colorspace sRGB -type TrueColor -define png:color-type=2 -define "$PNG_NO_TIMES" "$output"
}

# render_round_icon <size> <output>
# render_icon cut to a circle, for launchers that ask for a round icon.
render_round_icon() {
  size=$1
  output=$2
  radius=$((size / 2))
  mkdir -p "$(dirname "$output")"
  "$MAGICK" "$(rasterize "$BACKGROUND_SVG" "$size")" "$(rasterize "$ICON_SVG" "$size")" \
    -gravity center -composite \
    "(" -size "${size}x${size}" xc:none -fill white \
    -draw "circle $radius,$radius $radius,0" ")" \
    -compose DstIn -composite \
    -depth 8 -colorspace sRGB -type TrueColorAlpha -define "$PNG_NO_TIMES" "$output"
}
