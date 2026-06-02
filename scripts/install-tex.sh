#!/usr/bin/env bash
set -euo pipefail

TINY_DIR="${HOME}/.TinyTeX"

install_tinytex() {
  echo "Installing TinyTeX..."
  wget -qO- "https://yihui.org/tinytex/install-bin-unix.sh" | sh
}

install_packages() {
  echo "Installing LaTeX packages for xelatex + Times New Roman..."
  export PATH="${TINY_DIR}/bin/*:$PATH"
  tlmgr install geometry fontspec xunicode euenc xltxtra realscripts
  tlmgr path add
}

if command -v xelatex &>/dev/null; then
  echo "xelatex already available at $(command -v xelatex)"
  exit 0
fi

if [ -f "${TINY_DIR}/bin/x86_64-linux/xelatex" ] || [ -f "${TINY_DIR}/bin/aarch64-linux/xelatex" ]; then
  echo "TinyTeX found but not in PATH. Adding..."
  tlmgr path add
  exit 0
fi

install_tinytex
install_packages

echo ""
echo "TinyTeX installed. Add to your shell rc if not automatically picked up:"
echo "  eval \"\$(${TINY_DIR}/bin/*/tlmgr path add)\""
