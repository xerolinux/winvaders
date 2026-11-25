#!/usr/bin/env bash
# Usage: build.sh <path to libSDL3.so.0> [output dir]
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SDL=$(readlink -f "$1")
OUT=$(realpath -m "${2:-$ROOT/dist}")

PY_TAG=20261110
PY_VER=3.13.18
PY_SHA=f2d2199eb25880e07863b391cf7124e7ffa1338b0d65600dfcec117c4223a7fb
PYSIDE=6.12.0
TOOL_VER=1.9.1
TOOL_SHA=ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
APPDIR=$WORK/AppDir
mkdir -p "$APPDIR/usr/lib" "$OUT"

fetch() {
    curl -fsSL -o "$1" "$2"
    echo "$3  $1" | sha256sum -c --quiet -
}

fetch "$WORK/python.tar.gz" \
    "https://github.com/astral-sh/python-build-standalone/releases/download/$PY_TAG/cpython-$PY_VER+$PY_TAG-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz" \
    "$PY_SHA"
fetch "$WORK/appimagetool" \
    "https://github.com/AppImage/appimagetool/releases/download/$TOOL_VER/appimagetool-x86_64.AppImage" \
    "$TOOL_SHA"
chmod +x "$WORK/appimagetool"

tar -xzf "$WORK/python.tar.gz" -C "$APPDIR/usr"
PY=$APPDIR/usr/python/bin/python3
"$PY" -m pip install --no-cache-dir --no-compile "PySide6-Essentials==$PYSIDE" "PySide6-Addons==$PYSIDE"
"$PY" -m pip install --no-cache-dir --no-compile --no-deps "$ROOT"
"$PY" -m pip uninstall -y pip

# Addons is only needed for QtMultimedia; drop the rest, plus dev tools and headers.
SITE=$("$PY" -c 'import sysconfig; print(sysconfig.get_path("purelib"))')
QT=$SITE/PySide6
for m in WebEngine WebView WebChannel WebSockets Pdf 3D Quick3D Charts DataVisualization Graphs Location \
         Positioning Bluetooth Nfc Sensors SerialPort SerialBus TextToSpeech RemoteObjects Scxml StateMachine \
         HttpServer NetworkAuth SpatialAudio Designer Help UiTools VirtualKeyboard Lottie; do
    find "$QT" -depth \( -name "Qt$m*" -o -name "libQt6$m*" \) -exec rm -rf {} +
done
rm -rf "$QT"/{include,typesystems,glue,scripts,examples,Qt/translations} \
       "$QT"/{designer,assistant,linguist,lupdate,lrelease,qmllint,qmlformat,qmlls,balsam,balsamui,qsb,svgtoqml}
find "$APPDIR" -name '*.pyi' -delete
find "$APPDIR" -name '__pycache__' -prune -exec rm -rf {} +

# Qt's xcb plugin needs the xcb-util family, which many distros (Mint, Ubuntu) do not install by default.
for so in libxcb-cursor.so.0 libxcb-icccm.so.4 libxcb-keysyms.so.1 libxcb-image.so.0 \
          libxcb-render-util.so.0 libxcb-util.so.1 libxkbcommon-x11.so.0; do
    src=$(ldconfig -p | awk -v n="$so" '$1 == n && /x86-64/ {print $NF; exit}')
    [ -n "$src" ] || { echo "missing $so on build host" >&2; exit 1; }
    install -m644 "$(readlink -f "$src")" "$QT/Qt/lib/$so"
done
ldd "$QT/Qt/lib/libQt6XcbQpa.so.6" | grep -q "libxcb-cursor.so.0 => $QT/Qt/lib/" \
    || { echo "xcb plugin does not resolve bundled libxcb-cursor" >&2; exit 1; }

install -m755 "$SDL" "$APPDIR/usr/lib/libSDL3.so.0"
install -m755 "$ROOT/packaging/appimage/AppRun" "$APPDIR/AppRun"
install -m644 "$ROOT/data/winvaders.desktop" "$APPDIR/winvaders.desktop"
install -m644 "$ROOT/data/winvaders.svg" "$APPDIR/winvaders.svg"
ln -s winvaders.svg "$APPDIR/.DirIcon"

XDG_DATA_HOME=$WORK/data WINVADERS_SDL=$APPDIR/usr/lib/libSDL3.so.0 "$PY" -I "$ROOT/packaging/appimage/smoke.py"
find "$APPDIR" -name '__pycache__' -prune -exec rm -rf {} +

ARCH=x86_64 "$WORK/appimagetool" --appimage-extract-and-run "$APPDIR" "$OUT/WinVaders-x86_64.AppImage"
(cd "$OUT" && sha256sum WinVaders-x86_64.AppImage > WinVaders-x86_64.AppImage.sha256)
