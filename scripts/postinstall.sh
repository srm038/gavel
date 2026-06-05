#!/usr/bin/env bash
set -e
if [ -n "$INIT_CWD" ] && [ ! -f "$INIT_CWD/.helix/languages.toml" ]; then
  mkdir -p "$INIT_CWD/.helix"
  cat > "$INIT_CWD/.helix/languages.toml" << 'HELIX'
[[language]]
name = "yaml"
language-servers = ["yaml-language-server"]

[language-server.yaml-language-server]
command = "yaml-language-server"

[language-server.yaml-language-server.config]
yaml = { schemas = { "node_modules/gavel/schemas/minutes.schema.yml" = ["*.minutes.yml"], "node_modules/gavel/schemas/agenda.schema.yml" = ["*.agenda.yml"] } }
HELIX
fi
