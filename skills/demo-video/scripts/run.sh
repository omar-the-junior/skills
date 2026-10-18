#!/usr/bin/env bash
# Records one take: starts a private Xvfb display (1280x900, taller than the
# 720 px video so the tab bar sits above the filmed area) and runs the video
# script on it with DEMO_KIT pointing at these scripts.
# usage: run.sh <video-dir>/script.mjs
set -euo pipefail
KIT=$(cd "$(dirname "$0")" && pwd)
script=${1:?usage: run.sh <video-dir>/script.mjs}
export DEMO_KIT=$KIT
exec xvfb-run -a -s "-screen 0 1280x900x24 -nolisten tcp" node "$script"
