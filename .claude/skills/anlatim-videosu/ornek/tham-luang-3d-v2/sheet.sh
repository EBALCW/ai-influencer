#!/bin/zsh
# sheet.sh out.png id1 id2 ... : her çekimin iki still'ini yan yana dizer
cd "$(dirname "$0")"; out=$1; shift; ins=(); n=0
for s in "$@"; do for f in $(ls stills/$s-*.png); do ins+=(-i $f); n=$((n+1)); done; done
/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg -y -v error $ins -filter_complex "hstack=$n" $out
