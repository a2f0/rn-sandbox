#!/bin/sh
set -eu

exec "$(cd "$(dirname "$0")" && pwd)/detox-headless.sh" android "$@"
