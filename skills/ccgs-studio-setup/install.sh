#!/bin/sh
# Install the Claude Code Game Studios ZCode template into a project folder, pinned to one commit.
# Usage: sh install.sh <project-folder>
# Never overwrites a file: an existing file that differs keeps its content, and the template's version
# is written next to it as <file>.ccgs-new and listed at the end.
set -eu
REPO=https://github.com/Mike-7777777/gene-skills
COMMIT=0c27757227cce94bc686dd693f811d512d6a89b1
TREE=d5f339830f019dc1bf1238b20c838d8ef1eb69a1

[ $# -eq 1 ] || { echo "usage: sh install.sh <project-folder>" >&2; exit 2; }
command -v git >/dev/null || { echo "git is required: install Git, then rerun." >&2; exit 3; }
mkdir -p "$1"
TARGET=$(CDPATH= cd -- "$1" && pwd -P)

TMP=$(mktemp -d "${TMPDIR:-/tmp}/ccgs-template.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM
SRC=$TMP/src
git init -q "$SRC"
echo "Fetching template $COMMIT ..."
if ! git -C "$SRC" fetch -q --depth 1 "$REPO" "$COMMIT"; then
  echo "Could not fetch $REPO at $COMMIT: check the network or a proxy, then rerun." >&2; exit 4
fi
GOT=$(git -C "$SRC" rev-parse 'FETCH_HEAD^{tree}')
[ "$GOT" = "$TREE" ] || { echo "Template tree is $GOT, expected $TREE: refusing to install." >&2; exit 5; }
git -C "$SRC" checkout -q FETCH_HEAD

added=0 same=0 kept=0
: > "$TMP/kept"
git -C "$SRC" ls-files > "$TMP/files"
while IFS= read -r f; do
  if [ -e "$TARGET/$f" ]; then
    if cmp -s "$SRC/$f" "$TARGET/$f"; then same=$((same + 1)); else
      cp -p "$SRC/$f" "$TARGET/$f.ccgs-new"; echo "$f" >> "$TMP/kept"; kept=$((kept + 1)); fi
  else
    mkdir -p "$(dirname "$TARGET/$f")"; cp -p "$SRC/$f" "$TARGET/$f"; added=$((added + 1))
  fi
done < "$TMP/files"
mkdir -p "$TARGET/production/session-state"

[ -f "$TARGET/.zcode/hooks/yaml-helper.sh" ] && [ -f "$TARGET/project.yaml" ] || { echo "Install incomplete: .zcode/hooks/yaml-helper.sh or project.yaml missing in $TARGET." >&2; exit 6; }
echo "CCGS template $COMMIT installed in $TARGET: $added added, $same already identical, $kept kept as they were."
if [ "$kept" -gt 0 ]; then
  echo "Kept your version (template copy saved as <file>.ccgs-new):"; sed 's/^/  /' "$TMP/kept"
fi
echo "Next: restart ZCode with $TARGET as the opened folder, then type /start or /prototype <your game idea>."
