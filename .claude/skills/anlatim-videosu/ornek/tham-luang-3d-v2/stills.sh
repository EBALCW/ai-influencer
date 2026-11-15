#!/bin/zsh
# kullanım: stills.sh id1 id2 ...  -> stills/<id>-*.png (yarı çözünürlük), 3 süreç yan yana + hata özeti
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
printf "%s\n" "$@" | xargs -P 3 -I{} sh -c "$B -b -P film.py -- {} still 12 50 2>&1 | grep -E 'Error|Traceback|^  File|line [0-9]+' | grep -v INFO | sed 's/^/[{}] /' | tail -6"
