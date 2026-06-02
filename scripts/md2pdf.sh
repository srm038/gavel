#!/usr/bin/env bash
set -euo pipefail

file="${1:?Usage: md2pdf.sh <file.md> [sha]}"
sha="${2:-}"

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
\pagestyle{fancy}
\fancyhead{}
\fancyfoot[L]{}
\fancyfoot[C]{\thepage}
\fancyfoot[R]{\footnotesize\texttt{$sha}}
\renewcommand{\headrulewidth}{0pt}
HEADER
  args+=(--include-in-header "$header")
fi

pandoc "${args[@]}"
rc=$?

[ -n "${header:-}" ] && rm -f "$header"
exit $rc
