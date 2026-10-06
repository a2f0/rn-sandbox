#!/bin/sh
set -eu

# The Gradle wrapper jar is binary, so it is gitignored rather than committed.
# Regenerate it when missing. Only the jar is written; the committed
# gradle-wrapper.properties keeps deciding which Gradle version builds run on.

REPO_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)"
WRAPPER_DIR="$REPO_ROOT/android/gradle/wrapper"
WRAPPER_JAR="$WRAPPER_DIR/gradle-wrapper.jar"

[ -f "$WRAPPER_JAR" ] && exit 0

if ! command -v gradle >/dev/null 2>&1; then
  echo "Error: Gradle is needed to generate the wrapper jar (brew install gradle)." >&2
  exit 1
fi

echo "Generating android/gradle/wrapper/gradle-wrapper.jar..."
# Generate in an empty build so the wrapper task doesn't configure the app.
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
trap 'exit 1' HUP INT TERM
: >"$work_dir/settings.gradle.kts"
gradle -p "$work_dir" --quiet wrapper
cp "$work_dir/gradle/wrapper/gradle-wrapper.jar" "$WRAPPER_JAR"
