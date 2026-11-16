#!/bin/zsh
# kullanım: stills.sh [id1 id2 ...]  -> stills/<id>-*.png (yarı çözünürlük, iki kare), 3 süreç yan yana + hata özeti
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
L=${FILM_LANG:-tr}
if [ $# -gt 0 ]; then ids=("$@"); else ids=($(python3 -c "import json;print(' '.join(s['id'] for s in json.load(open('shots.$L.json'))))")); fi
printf "%s\n" $ids | xargs -P 3 -I{} sh -c "$B -b -P film.py -- {} still 24 50 2>&1 | grep -E 'Error|Traceback|^  File|line [0-9]+' | grep -v INFO | sed 's/^/[{}] /' | tail -6"
