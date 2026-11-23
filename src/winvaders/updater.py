import hashlib
import json
import logging
import os
from pathlib import Path

from PySide6.QtCore import Property, QObject, QProcess, QUrl, Signal, Slot
from PySide6.QtGui import QGuiApplication
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkReply, QNetworkRequest

from . import __version__

log = logging.getLogger("winvaders")

API = "https://api.github.com/repos/xerolinux/winvaders/releases/latest"
ASSET = "WinVaders-x86_64.AppImage"


def version_tuple(v: str):
    try:
        return tuple(int(p) for p in v.removeprefix("v").split("."))
    except ValueError:
        return None


def is_newer(latest: str, current: str) -> bool:
    a, b = version_tuple(latest), version_tuple(current)
    return a is not None and b is not None and a > b


def find_assets(release: dict):
    urls = {a.get("name"): a.get("browser_download_url") for a in release.get("assets", [])}
    image, sha = urls.get(ASSET), urls.get(ASSET + ".sha256")
    return (image, sha) if image and sha else None


def checksum_ok(data: bytes, sha_text: str) -> bool:
    parts = sha_text.split()
    return bool(parts) and hashlib.sha256(data).hexdigest() == parts[0].lower()


def swap_in(target: Path, data: bytes):
    tmp = target.with_name(target.name + ".new")
    try:
        tmp.write_bytes(data)
        tmp.chmod(0o755)
        os.replace(tmp, target)
    finally:
        tmp.unlink(missing_ok=True)


class Updater(QObject):
    """Self-update for the AppImage build; pacman installs never check."""

    stateChanged = Signal()

    def __init__(self, appimage: str | None = None, current: str = __version__, parent: QObject | None = None):
        super().__init__(parent)
        self.appimage = appimage
        self.current = current
        self._state = "idle"
        self._latest = ""
        self.assets = None
        self.net = None

    def _get_state(self):
        return self._state

    def _get_latest(self):
        return self._latest

    state = Property(str, _get_state, notify=stateChanged)
    latest = Property(str, _get_latest, notify=stateChanged)

    def set_state(self, state: str):
        self._state = state
        self.stateChanged.emit()

    def fetch(self, url: str, done):
        if self.net is None:
            self.net = QNetworkAccessManager(self)
        req = QNetworkRequest(QUrl(url))
        req.setRawHeader(b"User-Agent", f"WinVaders/{self.current}".encode())
        reply = self.net.get(req)

        def finished():
            ok = reply.error() == QNetworkReply.NetworkError.NoError
            if not ok:
                log.warning("update fetch failed: %s", reply.errorString())
            done(bytes(reply.readAll().data()) if ok else None)
            reply.deleteLater()

        reply.finished.connect(finished)

    def restart(self):
        QProcess.startDetached(self.appimage, [])
        QGuiApplication.quit()

    @Slot()
    def check(self):
        if self.appimage:
            self.fetch(API, self._on_release)

    def _on_release(self, body):
        try:
            release = json.loads(body or b"{}")
        except ValueError:
            return
        tag = release.get("tag_name", "")
        assets = find_assets(release)
        if assets and is_newer(tag, self.current):
            self.assets = assets
            self._latest = tag.removeprefix("v")
            self.set_state("available")

    @Slot()
    def install(self):
        if not self.assets or self._state == "downloading":
            return
        self.set_state("downloading")
        image_url, sha_url = self.assets
        self.fetch(sha_url, lambda sha: self.fetch(image_url, lambda data: self._on_image(sha, data))
                   if sha else self._on_image(None, None))

    def _on_image(self, sha, data):
        if not sha or not data or not checksum_ok(data, sha.decode(errors="replace")):
            log.warning("update download missing or checksum mismatch")
            self.set_state("failed")
            return
        try:
            swap_in(Path(self.appimage), data)
        except OSError as e:
            log.warning("could not replace %s: %s", self.appimage, e)
            self.set_state("failed")
            return
        self.restart()
