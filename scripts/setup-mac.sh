#!/usr/bin/env bash
# AI Influencer — macOS kurulum script'i
# Kullanım (repo kökünde): bash scripts/setup-mac.sh
# Tekrar çalıştırmak güvenlidir; kurulu olanları atlar.
set -euo pipefail

cd "$(dirname "$0")/.."

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m[OK]\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m[!]\033[0m %s\n' "$1"; }
has()  { command -v "$1" >/dev/null 2>&1; }

step "Homebrew"
if ! has brew; then
  if [ -n "${CI:-}" ]; then echo "CI ortamında Homebrew bulunamadı" >&2; exit 1; fi
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; else eval "$(brew shellenv)"; fi
ok "brew $(brew --version | head -1 | awk '{print $2}')"

step "Temel araçlar (git, gh, fnm, age)"
for pkg in git gh fnm age; do
  if has "$pkg"; then ok "$pkg mevcut"; else brew install "$pkg"; ok "$pkg kuruldu"; fi
done

step "VS Code"
if has code || [ -d "/Applications/Visual Studio Code.app" ]; then
  ok "VS Code mevcut"
elif [ -n "${CI:-}" ]; then
  warn "CI: VS Code atlandı"
else
  brew install --cask visual-studio-code
  ok "VS Code kuruldu"
fi
# 'code' komutu PATH'te değilse uygulama içinden ekle
if ! has code && [ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]; then
  export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
fi

step "Node.js ($(cat .nvmrc)) — fnm ile"
FNM_LINE='eval "$(fnm env --use-on-cd --shell zsh)"'
if [ ! -f "$HOME/.zshrc" ] || ! grep -qF "$FNM_LINE" "$HOME/.zshrc"; then
  printf '\n# fnm (Node sürüm yöneticisi)\n%s\n' "$FNM_LINE" >> "$HOME/.zshrc"
  ok "fnm ~/.zshrc'ye eklendi"
fi
eval "$(fnm env --shell bash)"
fnm install --corepack-enabled
fnm use
ok "node $(node -v)"

step "pnpm (corepack ile, sürüm package.json'dan)"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
corepack install
ok "pnpm $(pnpm -v)"

step "Bağımlılıklar"
pnpm install
ok "pnpm install tamam"

step ".env.local"
if [ -f .env.local ]; then ok ".env.local zaten var"; else cp .env.example .env.local; warn ".env.local oluşturuldu — değerleri parola yöneticisinden doldur"; fi

step "VS Code eklentileri"
if has code; then
  node -e "console.log(require('./.vscode/extensions.json').recommendations.join('\n'))" | while read -r ext; do
    code --install-extension "$ext" --force >/dev/null 2>&1 && ok "$ext" || warn "$ext kurulamadı"
  done
else
  warn "'code' komutu yok, eklentiler atlandı (VS Code açınca önerilen eklentileri kur)"
fi

step "Sağlık kontrolü"
node scripts/doctor.mjs

printf '\n\033[1;32mKurulum bitti.\033[0m Yeni bir terminal aç (fnm ayarının yüklenmesi için) ve: cd %s && code .\n' "$(pwd)"
