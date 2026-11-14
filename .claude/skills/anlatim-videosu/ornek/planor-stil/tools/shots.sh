#!/bin/sh
# Kullanım: tools/shots.sh <ad> <t1,t2,...>  -> snapshots/<ad>/sheet-N.jpg (satır başına 3 kare, 540 px)
set -e
cd "$(dirname "$0")/.."
export HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1
HF="$(cd .. && pwd)/.favstash-studio/runtime/node_modules/.bin/hyperframes"
rm -rf "snapshots/$1"
"$HF" snapshot . --describe false --no-end --at "$2" --output "snapshots/$1" < /dev/null > /dev/null 2>&1
cd "snapshots/$1"
set -- frame-*.png
i=0
while [ $# -gt 0 ]; do
  a=$1; b=${2:-$1}; c=${3:-$1}
  ffmpeg -v error -y -i "$a" -i "$b" -i "$c" -filter_complex "[0]scale=540:-1[a];[1]scale=540:-1[b];[2]scale=540:-1[c];[a][b][c]hstack=3" "sheet-$i.jpg"
  i=$((i+1)); shift; [ $# -gt 0 ] && shift; [ $# -gt 0 ] && shift
done
ls sheet-*.jpg
