#!/usr/bin/env bash
# gen-commands.sh — regenerate the slash-command file of skills (ZCode port).
# Python 3 does the work: gen-commands.py, beside this file, says what it does.
#
# Usage: bash .zcode/scripts/gen-commands.sh [<name> ...] [--root DIR] [--check]
#   -h, --help   what gen-commands.py does
#
# Exit codes: 0 done; 1 no Python 3 on PATH, or a file could not be read or
# written; 2 usage; 3 with --check, at least one command is out of date.

HERE="$(cd "$(dirname "$0")" && pwd)"
PY="$(command -v python3 2>/dev/null || command -v python 2>/dev/null)"
if [ -z "$PY" ]; then
  echo "gen-commands: Python 3 is required and was not found on PATH" >&2
  exit 1
fi
exec "$PY" "$HERE/gen-commands.py" "$@"
