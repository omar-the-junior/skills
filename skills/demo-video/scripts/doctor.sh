#!/usr/bin/env bash
# Checks everything a take needs and prints the install line for each missing
# piece. Run it from the folder that holds your videos (Playwright is looked up
# there). Exit 0 when ready, 1 when something is missing.
# usage: doctor.sh
set -uo pipefail
missing=0
ok() { printf '  ok    %s\n' "$1"; }
no() { printf '  MISS  %s\n        %s\n' "$1" "$2"; missing=1; }

if [ -r /etc/os-release ]; then . /etc/os-release; fi
family=${ID_LIKE:-${ID:-unknown}}
pkg() { # pkg <arch> <debian> <fedora>
  case " $ID $family " in
    *" arch "*) echo "sudo pacman -S --needed $1" ;;
    *" debian "*|*" ubuntu "*) echo "sudo apt install $2" ;;
    *" fedora "*|*" rhel "*) echo "sudo dnf install $3" ;;
    *) echo "install: $1 (Arch) / $2 (Debian, Ubuntu) / $3 (Fedora)" ;;
  esac
}

[ "$(uname -s)" = Linux ] && ok "Linux" || no "Linux" "Capture uses Xvfb and x11grab, which need Linux (WSL2 untested)."

# Playwright needs Node 20+; Debian and Ubuntu apt ship older, so point past apt.
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then ok "node $(node -v)"; else no "node 20+ (Playwright needs it)" "install from https://nodejs.org or a version manager (nvm, fnm, mise); distro packages are often older"; fi

if command -v ffmpeg >/dev/null; then
  # Read the lists whole: grep -q exiting early would SIGPIPE ffmpeg and fail the pipe.
  devices=$(ffmpeg -hide_banner -devices 2>/dev/null)
  filters=$(ffmpeg -hide_banner -filters 2>/dev/null)
  grep -q x11grab <<<"$devices" && ok "ffmpeg x11grab" || no "ffmpeg with x11grab" "this ffmpeg build lacks X11 capture; use your distro's ffmpeg package"
  grep -qw subtitles <<<"$filters" && ok "ffmpeg subtitles (libass)" || no "ffmpeg with libass" "this ffmpeg build cannot burn captions; use your distro's ffmpeg package"
else
  no "ffmpeg" "$(pkg ffmpeg ffmpeg ffmpeg)"
fi

command -v Xvfb >/dev/null && ok "Xvfb" || no "Xvfb" "$(pkg xorg-server-xvfb xvfb xorg-x11-server-Xvfb)"
command -v xvfb-run >/dev/null && ok "xvfb-run" || no "xvfb-run" "$(pkg xorg-server-xvfb xvfb xorg-x11-server-Xvfb)"
command -v xauth >/dev/null && ok "xauth" || no "xauth (xvfb-run needs it)" "$(pkg xorg-xauth xauth xorg-x11-xauth)"
{ command -v magick >/dev/null || command -v montage >/dev/null; } && ok "ImageMagick" || no "ImageMagick (contact sheets)" "$(pkg imagemagick imagemagick ImageMagick)"
command -v xdotool >/dev/null && ok "xdotool (optional: acceptBrowserPrompt)" || printf '  --    xdotool not found; only acceptBrowserPrompt() needs it: %s\n' "$(pkg xdotool xdotool xdotool)"

if node -e "require.resolve('playwright')" 2>/dev/null || node -e "require.resolve('@playwright/test')" 2>/dev/null; then
  ok "playwright (from $(pwd))"
  # Launch it, not just find it: a downloaded browser can still lack system libraries.
  # channel 'chromium' starts the full browser the takes use, not the headless shell.
  launch="const m=require(require.resolve(process.argv[1],{paths:[process.cwd()]}));m.chromium.launch({channel:'chromium',timeout:30000}).then(b=>b.close(),e=>{console.error(e.message.split('\n')[0]);process.exit(1)})"
  pw=playwright; node -e "require.resolve('playwright')" 2>/dev/null || pw=@playwright/test
  if chromium_err=$(node -e "$launch" "$pw" 2>&1); then
    ok "chromium for playwright (launches)"
  else
    no "chromium for playwright: ${chromium_err##*$'\n'}" "$(case " $ID $family " in *" debian "*|*" ubuntu "*) echo "npx playwright install --with-deps chromium   (adds the system libraries it needs; asks for sudo)" ;; *) echo "npx playwright install chromium, then install the system libraries named in the error" ;; esac)"
  fi
else
  no "playwright in $(pwd)" "npm init -y && npm i -D playwright && npx playwright install chromium"
fi

[ $missing = 0 ] && echo "ready" || echo "missing pieces above"
exit $missing
