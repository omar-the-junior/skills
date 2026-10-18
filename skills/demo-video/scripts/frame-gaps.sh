#!/usr/bin/env bash
# Measures how smooth a stretch of video is: how many frames actually change,
# and the longest freeze between changes. Usage: frame-gaps.sh VIDEO START END
set -euo pipefail
video=$1 start=$2 end=$3
ffmpeg -hide_banner -ss "$start" -to "$end" -i "$video" -an \
    -vf 'mpdecimate=hi=200:lo=100:frac=0.05,showinfo' -f null - 2>&1 |
    grep -o 'pts_time:[0-9.]*' | cut -d: -f2 |
    awk -v span="$(awk -v a="$start" -v b="$end" 'BEGIN { print b - a }')" '
        NR > 1 { gap = $1 - prev; if (gap > max) max = gap; if (gap > 0.2) long++ }
        { prev = $1; n++ }
        END { printf "changed frames: %d in %.1fs (%.1f/s)  longest freeze: %.2fs  freezes >0.2s: %d\n", n, span, n / span, max, long }'
