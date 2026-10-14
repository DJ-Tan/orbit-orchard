#!/bin/sh
# usage: run.sh flow|offline|rest|restshots|device2|shots|cards|friends|frshots|all (emulators running, dev/friends/serve.py on WPORT; FF_CA adds root CAs to the test profile)
cd "$(dirname "$0")"
mkdir -p shots/dl
PORT=${WPORT:-8771}
BASE="http://127.0.0.1:$PORT/dev/web"
ff() {
  P=$(mktemp -d "${TMPDIR:-/tmp}/ffweb.XXXXXX")
  cp user.js "$P/user.js"
  echo "user_pref(\"browser.download.dir\", \"$PWD/shots/dl\");" >> "$P/user.js"
  if [ -n "$FF_CA" ]; then certutil -N -d "sql:$P" --empty-password; for c in $FF_CA; do certutil -A -n "$(basename "$c")" -t "C,," -i "$c" -d "sql:$P"; done; fi
  K="$1-$(date +%s%N)"
  case "$3" in *\?*) U="$3&k=$K" ;; *) U="$3?k=$K" ;; esac
  flock /tmp/claude-1020/ff.lock timeout "${4:-120}" firefox --headless --no-remote --profile "$P" --screenshot "$PWD/shots/$1.png" --window-size="$(echo "$2" | tr x ,)" "$U" > "shots/$1.log" 2>&1
  rm -rf "$P"
  grep -a '\[t\]\|\[ERR\]' "shots/$1.log" | sed 's/^console\.[a-z]*: "//; s/"$//'
}
case "$1" in flow|all) ff flow 1400x1000 "$BASE/flow.html" 300 ;; esac
case "$1" in offline|all)
  python3 killable.py . 8772 &
  sleep 1
  ff offline 1400x1000 "$BASE/offline.html" 200
  kill $! 2>/dev/null
  ;;
esac
case "$1" in rest|all) ff rest 1400x1000 "$BASE/rest.html" 420 ;; esac
case "$1" in restshots)
  ff restseed 1400x1000 "$BASE/rest.html?seed=1" 120
  for W in 1280x800 400x800; do
    N=${W%%x*}
    ff title-rest-$N $W "$BASE/site/index.html?emu=1&allow=4,400&shot=title-rest&who=alice"
    ff settings-rest-$N $W "$BASE/site/index.html?emu=1&allow=4,400&shot=settings-rest&who=alice"
    ff friends-rest-$N $W "$BASE/site/index.html?emu=1&allow=4,400&shot=friends-rest&who=alice"
  done
  ;;
esac
case "$1" in device2|all) ff device2 1280x800 "$BASE/site/index.html?emu=1&shot=settings-device2-in&who=alice" ;; esac
case "$1" in shots|all)
  ff title-out-1280 1280x800 "$BASE/site/index.html?emu=1&shot=title-out"
  ff title-out-400 400x800 "$BASE/site/index.html?emu=1&shot=title-out"
  ff journey-out-1280 1280x800 "$BASE/site/index.html?emu=1&shot=journey-out"
  ff journey-out-400 400x800 "$BASE/site/index.html?emu=1&shot=journey-out"
  ;;
esac
case "$1" in shots|cards|all)
  ff settings-out-1280 1280x800 "$BASE/site/index.html?emu=1&shot=settings-out"
  ff settings-out-400 400x800 "$BASE/site/index.html?emu=1&shot=settings-out"
  ff settings-in-1280 1280x800 "$BASE/site/index.html?emu=1&shot=settings-in"
  ff settings-in-400 400x800 "$BASE/site/index.html?emu=1&shot=settings-in"
  ;;
esac
case "$1" in friends|frshots|all)
  python3 killable.py ../.. 8773 &
  sleep 1
  if [ "$1" = frshots ]; then ff frseed 1400x1000 "$BASE/friends.html?seed=1" 300; else ff friends 1400x1000 "$BASE/friends.html" 600; fi
  kill $! 2>/dev/null
  ;;
esac
case "$1" in frshots)
  for W in 1280x800 400x800; do
    N=${W%%x*}
    ff fr-out-$N $W "$BASE/site/index.html?emu=1&shot=friends-out"
    ff fr-cards-$N $W "$BASE/site/index.html?emu=1&shot=friends-in&who=alice"
    ff fr-inbox-$N $W "$BASE/site/index.html?emu=1&shot=friends-in&who=bob"
    ff fr-safe-$N $W "$BASE/site/index.html?emu=1&shot=friends-in&who=alice&safe=first"
    ff fr-add-$N $W "$BASE/site/index.html?emu=1&shot=friends-in&who=alice&scroll=%23frAdd"
  done
  ;;
esac
