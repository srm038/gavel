#!/usr/bin/env bash
set -e

if [ -z "$INIT_CWD" ]; then exit 0; fi

mkdir -p "$INIT_CWD/.helix"
ln -sf "$PWD/config/helix-languages.toml" "$INIT_CWD/.helix/languages.toml"
