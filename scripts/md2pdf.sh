#!/usr/bin/env bash
set -euo pipefail

file="${1:?Usage: md2pdf.sh <file.md>}"
sha=""
dir=$(dirname "$file")
gitRoot=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)
if [ -n "$gitRoot" ]; then
  src="${file%.md}.yml"
  [ -f "$src" ] && sha=$(git -C "$gitRoot" log -1 --format=%h -- "$src" 2>/dev/null)
  [ -z "$sha" ] && sha=$(git -C "$gitRoot" rev-parse --short HEAD 2>/dev/null)
fi

args=(
  "$file" -o "${file%.md}.pdf"
  --pdf-engine=xelatex
  -V mainfont="Times New Roman"
  -V fontsize=12pt
  -V geometry:margin=1in
)

if [ -n "$sha" ]; then
  header=$(mktemp)
  cat > "$header" <<-HEADER
\usepackage{fancyhdr}
\usepackage{xcolor}
\pagestyle{fancy}
\fancyhead{}
\fancyfoot[L]{}
\fancyfoot[C]{\thepage}
\fancyfoot[R]{\textcolor{white}{\footnotesize\texttt{$sha}}}
\renewcommand{\headrulewidth}{0pt}
HEADER
  args+=(--include-in-header "$header")
fi

pandoc "${args[@]}"
rc=$?

[ -n "${header:-}" ] && rm -f "$header"
exit $rc
