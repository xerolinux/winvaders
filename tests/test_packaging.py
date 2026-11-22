import configparser
import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def entry(path):
    cp = configparser.ConfigParser(interpolation=None)
    cp.optionxform = str
    cp.read(path)
    return cp["Desktop Entry"]


def test_desktop_file_valid():
    e = entry(DATA / "winvaders.desktop")
    assert e["Type"] == "Application"
    assert e["Name"] == "WinVaders"
    assert e["GenericName"] == "Arcade Shooter"
    assert e["Comment"] == "Defend Linux from invading Microsoft apps"
    assert e["Exec"] == "winvaders"
    assert e["Icon"] == "winvaders"
    assert e["Terminal"] == "false"
    assert e["Categories"] == "Game;ArcadeGame;"
    assert e["StartupWMClass"] == "winvaders"


@pytest.mark.skipif(not shutil.which("desktop-file-validate"), reason="desktop-file-utils missing")
@pytest.mark.parametrize("name", ["winvaders.desktop", "winvaders-shortcut-autostart.desktop"])
def test_desktop_files_pass_validator(name):
    result = subprocess.run(["desktop-file-validate", str(DATA / name)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_autostart_only_places_icon():
    e = entry(DATA / "winvaders-shortcut-autostart.desktop")
    assert e["Exec"] == "/usr/lib/winvaders/winvaders-shortcut"
    assert e["NoDisplay"] == "true"


def test_icon_is_svg():
    root = ET.parse(DATA / "winvaders.svg").getroot()
    assert root.tag.endswith("svg")
    assert root.get("viewBox") == "0 0 128 128"


def test_pkgbuild_fields():
    text = (ROOT / "packaging/PKGBUILD").read_text()
    for needle in (
        "pkgname=winvaders",
        "arch=('any')",
        "license=('GPL-3.0-or-later')",
        "usr/lib/winvaders/winvaders-shortcut",
        "etc/xdg/autostart/winvaders-shortcut.desktop",
        "usr/share/applications/winvaders.desktop",
        "usr/share/icons/hicolor/scalable/apps/winvaders.svg",
    ):
        assert needle in text, needle
    assert "etc/skel" not in text
