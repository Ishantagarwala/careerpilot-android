#!/usr/bin/env bash
#
# Builds png/00-contact-sheet.png — all ten screens in one 5x2 sheet.
#
# This replaces an `npm run contact-sheet` that never existed: the design folder
# has no package.json, so that command failed and the committed sheet could not
# be reproduced.
#
# The screen list is spelled out ON PURPOSE. A `png/0*.png` glob also matches
# 00-contact-sheet.png itself, which gives montage 11 inputs for a 10-tile grid
# and makes it silently split the output into 00-contact-sheet-0.png and -1.png.
set -euo pipefail

cd "$(dirname "$0")"

SCREENS=(
  01-sign-in 02-hub-chat 03-hub-threads 04-career 05-roadmap
  06-build-resume 07-build-jobs 08-me 09-first-run 10-dark-offline
)

inputs=()
for s in "${SCREENS[@]}"; do
  [ -f "png/$s.png" ] || { echo "missing png/$s.png — run build.py first" >&2; exit 1; }
  inputs+=("png/$s.png")
done

# 620x1038 per cell, matching the proportions of the committed sheet.
montage "${inputs[@]}" \
  -tile 5x2 \
  -geometry 620x1038+18+18 \
  -background '#0e100c' \
  "png/00-contact-sheet.png"

echo "wrote png/00-contact-sheet.png"
