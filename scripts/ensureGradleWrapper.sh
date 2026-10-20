#!/bin/sh
set -eu

# The Gradle wrapper jar is binary, so it is gitignored rather than committed.
# Regenerate it when missing. Only the jar is written; the committed
# gradle-wrapper.properties keeps deciding which Gradle version builds run on.
#
# With --optional (npm's prepare script), a missing Gradle is a warning, so
# installing JavaScript dependencies doesn't require it. CI skips it entirely:
# jobs that build Android generate the jar in their build step, and running
# Gradle before setup-gradle stops it from restoring its cache.

REPO_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)"
WRAPPER_DIR="$REPO_ROOT/android/gradle/wrapper"
WRAPPER_JAR="$WRAPPER_DIR/gradle-wrapper.jar"

[ -f "$WRAPPER_JAR" ] && exit 0
[ "${1:-}" = "--optional" ] && [ -n "${CI:-}" ] && exit 0

if ! command -v gradle >/dev/null 2>&1; then
  if [ "${1:-}" = "--optional" ]; then
    echo "Warning: skipped android/gradle/wrapper/gradle-wrapper.jar; install Gradle (mise install) and rerun scripts/ensureGradleWrapper.sh." >&2
    exit 0
  fi
  echo "Error: Gradle is needed to generate the wrapper jar (mise install)." >&2
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
