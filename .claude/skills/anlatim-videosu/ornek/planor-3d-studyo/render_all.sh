#!/bin/zsh
# Tüm çekimleri (ya da verilenleri) render eder: önce görüntü geçişi (720x1280), sonra yazı geçişi (1080x1920, saydam).
# 3 Blender süreci yan yana. use_overwrite=False: yarıda kesilirse aynı komut kaldığı yerden sürer.
# Çekimi değiştirdiysen önce frames/<id> ve labels/<id> klasörlerini sil.
#   FILM_LANG=tr ./render_all.sh            -> shots.<dil>.json'daki her çekim
#   ./render_all.sh s04 s10                 -> yalnızca bunlar
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
L=${FILM_LANG:-tr}
if [ $# -gt 0 ]; then ids=("$@"); else ids=($(python3 -c "import json;print(' '.join(s['id'] for s in json.load(open('shots.$L.json'))))")); fi
mkdir -p logs frames labels
for mode in anim lab; do
  printf "%s\n" $ids | xargs -P 3 -I{} sh -c "s=\$(date +%s); $B -b -P film.py -- {} $mode 24 > logs/{}-$mode.log 2>&1; echo {} $mode \$(( \$(date +%s) - s )) sn"
done
echo BITTI
