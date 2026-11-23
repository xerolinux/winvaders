import hashlib
import os
import stat

import pytest

from winvaders import updater

URL = "https://github.com/xerolinux/winvaders/releases/download/v9.9.9/"
RELEASE = {
    "tag_name": "v9.9.9",
    "assets": [
        {"name": "WinVaders-x86_64.AppImage", "browser_download_url": URL + "WinVaders-x86_64.AppImage"},
        {"name": "WinVaders-x86_64.AppImage.sha256", "browser_download_url": URL + "WinVaders-x86_64.AppImage.sha256"},
    ],
}


def test_is_newer():
    assert updater.is_newer("v1.4.0", "1.3.0")
    assert updater.is_newer("1.10.0", "1.9.9")
    assert not updater.is_newer("v1.3.0", "1.3.0")
    assert not updater.is_newer("1.2.9", "1.3.0")
    assert not updater.is_newer("garbage", "1.3.0")


def test_find_assets():
    assert updater.find_assets(RELEASE) == (URL + "WinVaders-x86_64.AppImage", URL + "WinVaders-x86_64.AppImage.sha256")
    assert updater.find_assets({"assets": RELEASE["assets"][:1]}) is None
    assert updater.find_assets({}) is None


def test_checksum_ok():
    data = b"new build"
    digest = hashlib.sha256(data).hexdigest()
    assert updater.checksum_ok(data, f"{digest}  WinVaders-x86_64.AppImage\n")
    assert not updater.checksum_ok(b"tampered", f"{digest}  WinVaders-x86_64.AppImage\n")
    assert not updater.checksum_ok(data, "")


def test_swap_in_replaces_executable(tmp_path):
    target = tmp_path / "WinVaders.AppImage"
    target.write_bytes(b"old")
    updater.swap_in(target, b"new")
    assert target.read_bytes() == b"new"
    assert os.stat(target).st_mode & stat.S_IXUSR
    assert sorted(p.name for p in tmp_path.iterdir()) == ["WinVaders.AppImage"]


class FakeUpdater(updater.Updater):
    def __init__(self, responses, **kw):
        super().__init__(**kw)
        self.responses = responses
        self.restarted = False

    def fetch(self, url, done):
        done(self.responses.get(url))

    def restart(self):
        self.restarted = True


def test_check_does_nothing_outside_appimage(qapp):
    u = FakeUpdater({updater.API: b"{}"}, appimage=None, current="1.0.0")
    u.check()
    assert u.state == "idle"


def test_check_and_install(qapp, tmp_path):
    import json

    image = tmp_path / "WinVaders.AppImage"
    image.write_bytes(b"old")
    new = b"fresh build"
    responses = {
        updater.API: json.dumps(RELEASE).encode(),
        URL + "WinVaders-x86_64.AppImage.sha256": hashlib.sha256(new).hexdigest().encode() + b"  x\n",
        URL + "WinVaders-x86_64.AppImage": new,
    }
    u = FakeUpdater(responses, appimage=str(image), current="1.3.0")
    u.check()
    assert (u.state, u.latest) == ("available", "9.9.9")
    u.install()
    assert image.read_bytes() == new
    assert u.restarted


@pytest.mark.parametrize("bad", ["sha", "image"])
def test_install_fails_safely(qapp, tmp_path, bad):
    import json

    image = tmp_path / "WinVaders.AppImage"
    image.write_bytes(b"old")
    responses = {
        updater.API: json.dumps(RELEASE).encode(),
        URL + "WinVaders-x86_64.AppImage.sha256": hashlib.sha256(b"fresh").hexdigest().encode(),
        URL + "WinVaders-x86_64.AppImage": b"tampered" if bad == "sha" else None,
    }
    u = FakeUpdater(responses, appimage=str(image), current="1.3.0")
    u.check()
    u.install()
    assert u.state == "failed"
    assert image.read_bytes() == b"old"
    assert not u.restarted


def test_check_ignores_same_version(qapp, tmp_path):
    import json

    u = FakeUpdater({updater.API: json.dumps(RELEASE).encode()}, appimage=str(tmp_path / "a"), current="9.9.9")
    u.check()
    assert u.state == "idle"
