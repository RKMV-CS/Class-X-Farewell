#!/usr/bin/env bash
# Creates short coloured test clips with the cue id burned in. Requires ffmpeg (with drawtext/freetype).
cd "$(dirname "$0")" || exit 1
mkdir -p clips
FONT="$(fc-match -f '%{file}' sans 2>/dev/null)"
[ -z "$FONT" ] && for f in /System/Library/Fonts/Helvetica.ttc /Library/Fonts/Arial.ttf /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf; do [ -f "$f" ] && FONT="$f" && break; done
FONTOPT=""; [ -n "$FONT" ] && FONTOPT=":fontfile=${FONT}"
COLORS=(0x1f77b4 0xff7f0e 0x2ca02c 0xd62728 0x9467bd 0x8c564b 0xe377c2 0x7f7f7f 0x17becf 0xbcbd22 0x393b79)
i=0
for id in $(node -e 'for (const c of require("./cues.json")) console.log(c.id)'); do
  col="${COLORS[$((i % ${#COLORS[@]}))]}"; i=$((i+1))
  # 4s clip: solid colour; text pulses in the middle but is fully identical at t=0 and t=end
  # (alpha is 1 at both ends) so first and last frames match like real clips should.
  ffmpeg -y -loglevel error -f lavfi -i "color=c=${col}:s=1280x720:r=30:d=4" -f lavfi -i "sine=frequency=$((300+i*40)):duration=4" \
    -vf "drawtext=text='${id}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2${FONTOPT},drawtext=text='%{pts\:hms}':fontcolor=white:fontsize=36:x=20:y=h-60${FONTOPT}:enable='between(t,1,3)'" \
    -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "clips/${id}.mp4" && echo "made clips/${id}.mp4"
done
