#!/bin/zsh
# bütün çekimlerin kontak tabakaları: /tmp/st/{a..g}.png
cd "$(dirname "$0")"; mkdir -p /tmp/st
./sheet.sh /tmp/st/a.png s01 s02 s03a; ./sheet.sh /tmp/st/b.png s03b s04 s05; ./sheet.sh /tmp/st/c.png s06a s06b s07
./sheet.sh /tmp/st/d.png s08 s09 s10; ./sheet.sh /tmp/st/e.png s11 s12a s12b; ./sheet.sh /tmp/st/f.png s13a s13b s14a; ./sheet.sh /tmp/st/g.png s14b s15
