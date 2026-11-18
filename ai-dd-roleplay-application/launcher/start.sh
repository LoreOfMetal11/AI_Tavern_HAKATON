#!/usr/bin/env bash
cd "$(dirname "$0")/.." || exit 1
exec node launcher/launcher.mjs
