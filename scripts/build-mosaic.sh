#!/usr/bin/env bash
# Build the generated-trajectory mosaic.
#
# The trajectory wall shows 81 clips at once. Playing 81 <video> elements is not
# viable -- browsers cap concurrent hardware decoders and silently fall back to
# software past a handful, which pegs the CPU and makes the whole page scroll
# badly -- so the clips are precomposited into ONE 9x9 mosaic video that the page
# plays as a single stream (the same trick Do as I Do uses for its Expand
# canvas). js/mosaic-zoom.js maps a pointer position back to a cell.
#
# Clip ORDER comes from scripts/trajectory_clips.txt, one path per line, and is
# row-major: cell (gx, gy) is line gy*9 + gx. That file is the source of truth --
# the page markup no longer lists the clips. Re-run this whenever it changes.
#
# Usage: scripts/build-mosaic.sh        (from the repo root)
set -euo pipefail
cd "$(dirname "$0")/.."

LIST=scripts/trajectory_clips.txt
OUT=assets/trajectories/mosaic.mp4

COLS=9
ROWS=9
CELL_W=256                 # per-cell pixels -> mosaic is 2304x1296
CELL_H=144
GAP=2                      # padding per side -> 2*GAP between neighbours, matching
                           # the 4px grid gap the separate clips used to have
DUR=9                      # seconds; shorter clips loop to fill, longer are trimmed.
                           # The clips run 5.8-13.5s (median 8.9), so 9 keeps most
                           # of them essentially whole.
FPS=24

INNER_W=$((CELL_W - 2 * GAP))
INNER_H=$((CELL_H - 2 * GAP))

# Read the list with a while-loop rather than `mapfile`: macOS ships bash 3.2,
# which predates it, and this script is meant to run from a stock shell.
clips=()
while IFS= read -r line || [ -n "$line" ]; do
    [ -n "$line" ] && clips+=("$line")
done < "$LIST"
n=${#clips[@]}
if [ "$n" -ne $((COLS * ROWS)) ]; then
    echo "ERROR: $LIST must list $((COLS * ROWS)) clips, got $n" >&2
    exit 1
fi

inputs=() filter="" labels=""
i=0
for f in "${clips[@]}"; do
    if [ ! -f "$f" ]; then echo "ERROR: missing clip: $f" >&2; exit 1; fi
    # Loop each input forever; the output -t trims the whole mosaic to DUR.
    inputs+=(-stream_loop -1 -t "$DUR" -i "$f")
    # Scale+crop to the inner box so the grid is uniform, then pad back out to the
    # full cell with white. The padding is what draws the gutter between clips --
    # the page background is white, so it reads exactly like the old grid gap.
    filter+="[$i:v]scale=${INNER_W}:${INNER_H}:force_original_aspect_ratio=increase,"
    filter+="crop=${INNER_W}:${INNER_H},"
    filter+="pad=${CELL_W}:${CELL_H}:${GAP}:${GAP}:white,"
    filter+="setsar=1,fps=${FPS}[v$i];"
    labels+="[v$i]"
    i=$((i + 1))
done
filter+="${labels}xstack=inputs=${n}:grid=${COLS}x${ROWS}[out]"

echo "Building $OUT: ${COLS}x${ROWS} cells of ${CELL_W}x${CELL_H} -> $((COLS * CELL_W))x$((ROWS * CELL_H)), ${DUR}s @ ${FPS}fps"
ffmpeg -y -hide_banner -loglevel warning \
    "${inputs[@]}" \
    -filter_complex "$filter" -map "[out]" \
    -t "$DUR" -r "$FPS" -an \
    -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow -movflags +faststart \
    "$OUT"
echo "  -> $(du -h "$OUT" | cut -f1)  $OUT"
