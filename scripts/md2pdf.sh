#!/usr/bin/env bash
set -euo pipefail

file="${1:?Usage: md2pdf.sh <file.md> [output.pdf]>}"
out="${2:-${file%.md}.pdf}"
sha=""
dir=$(dirname "$file")
gitRoot=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || true
if [ -n "$gitRoot" ]; then
  src="${file%.md}.yml"
  [ -f "$src" ] && sha=$(git -C "$gitRoot" log -1 --format=%h -- "$src" 2>/dev/null) || true
  [ -z "$sha" ] && sha=$(git -C "$gitRoot" rev-parse --short HEAD 2>/dev/null) || true
fi

args=(
  "$file" -o "$out"
  --pdf-engine=xelatex
  -V mainfont="Times New Roman"
  -V fontsize=12pt
  -V geometry:margin=1in
)

header=$(mktemp)
cat > "$header" <<-HEADER
\usepackage{fancyhdr}
\usepackage{xcolor}
\renewenvironment{quote}
  {\list{}{\rightmargin\leftmargin}\item\relax\itshape\small}
  {\endlist}
HEADER
if [ -n "$sha" ]; then
  cat >> "$header" <<-HEADER
\pagestyle{fancy}
\fancyhead{}
\fancyfoot[L]{}
\fancyfoot[C]{\thepage}
\fancyfoot[R]{\textcolor{white}{\footnotesize\texttt{$sha}}}
\renewcommand{\headrulewidth}{0pt}
HEADER
fi
args+=(--include-in-header "$header")

pandoc "${args[@]}"
rc=$?

[ -n "${header:-}" ] && rm -f "$header"
exit $rc
