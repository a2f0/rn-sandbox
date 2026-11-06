#!/bin/sh
set -eu

# The Gradle wrapper jar is binary, so it is gitignored rather than committed.
# Regenerate it when missing. Only the jar is written; the committed
# gradle-wrapper.properties keeps deciding which Gradle version builds run on.
#
# With --optional (the prepare script), a missing Gradle is a warning, so
# installing JavaScript dependencies doesn't require it. CI skips it entirely:
# jobs that build Android generate the jar in their build step, and running
# Gradle before setup-gradle stops it from restoring its cache.

REPO_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd -P)"
WRAPPER_DIR="$REPO_ROOT/android/gradle/wrapper"
WRAPPER_JAR="$WRAPPER_DIR/gradle-wrapper.jar"

# A jar is usable when it is a complete zip. Without unzip, a non-empty file
# has to do.
jar_ok() {
  [ -s "$1" ] || return 1
  command -v unzip >/dev/null 2>&1 || return 0
  unzip -tq "$1" >/dev/null 2>&1
}

# A truncated jar, such as one an interrupted copy left, is regenerated.
jar_ok "$WRAPPER_JAR" && exit 0
[ "${1:-}" = "--optional" ] && [ -n "${CI:-}" ] && exit 0

if ! command -v gradle >/dev/null 2>&1; then
  if [ "${1:-}" = "--optional" ]; then
    echo "Warning: skipped android/gradle/wrapper/gradle-wrapper.jar; install Gradle (mise install) and rerun scripts/dev/ensureGradleWrapper.sh." >&2
    exit 0
  fi
  echo "Error: Gradle is needed to generate the wrapper jar (mise install)." >&2
  exit 1
fi

echo "Generating android/gradle/wrapper/gradle-wrapper.jar..."
# Generate in an empty build so the wrapper task doesn't configure the app.
# The jar is copied next to its destination, checked, and renamed into place,
# so a failed or interrupted copy never leaves a partial jar that later runs
# would trust.
work_dir=$(mktemp -d)
temp_jar=
trap 'rm -rf "$work_dir"; [ -z "$temp_jar" ] || rm -f "$temp_jar"' EXIT
trap 'exit 1' HUP INT TERM
: >"$work_dir/settings.gradle.kts"
gradle -p "$work_dir" --quiet wrapper
# Named by process ID rather than made by mktemp, so cp creates it with the
# usual permissions.
temp_jar="$WRAPPER_DIR/.gradle-wrapper.jar.$$"
cp "$work_dir/gradle/wrapper/gradle-wrapper.jar" "$temp_jar"
if ! jar_ok "$temp_jar"; then
  echo "Error: Gradle generated an incomplete wrapper jar." >&2
  exit 1
fi
mv -f "$temp_jar" "$WRAPPER_JAR"
temp_jar=
