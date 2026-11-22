import os
import stat
import subprocess
from pathlib import Path

import pytest

from winvaders import shortcut

SCRIPT = Path(__file__).resolve().parent.parent / "data/winvaders-shortcut"


@pytest.fixture
def env(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    src = tmp_path / "winvaders.desktop"
    src.write_text("[Desktop Entry]\nName=WinVaders\n")
    fakebin = tmp_path / "bin"
    fakebin.mkdir()
    xdg = fakebin / "xdg-user-dir"
    xdg.write_text("#!/bin/sh\nexit 0\n")
    xdg.chmod(0o755)
    return {
        "HOME": str(home),
        "PATH": f"{fakebin}:/usr/bin:/bin",
        "WINVADERS_DESKTOP_FILE": str(src),
        "_src": src,
        "_home": home,
        "_xdg": xdg,
    }


def run(env, *args):
    clean = {k: v for k, v in env.items() if not k.startswith("_")}
    return subprocess.run([str(SCRIPT), *args], env=clean, capture_output=True, text=True, timeout=10)


def marker(env):
    return env["_home"] / ".local/share/winvaders/shortcut-done"


def icon(env, desk="Desktop"):
    return env["_home"] / desk / "winvaders.desktop"


def test_first_run_creates_icon_and_marker(env):
    assert run(env).returncode == 0
    assert icon(env).read_text() == env["_src"].read_text()
    assert stat.S_IMODE(icon(env).stat().st_mode) == 0o755
    assert marker(env).exists()


def test_second_run_respects_marker(env):
    run(env)
    icon(env).unlink()
    assert run(env).returncode == 0
    assert not icon(env).exists()


def test_force_recreates(env):
    run(env)
    icon(env).unlink()
    assert run(env, "--force").returncode == 0
    assert icon(env).exists()


def test_missing_source_is_noop(env):
    env["_src"].unlink()
    result = run(env)
    assert result.returncode == 0
    assert not icon(env).exists()
    assert not marker(env).exists()


def test_uses_xdg_user_dir(env):
    env["_xdg"].write_text(f"#!/bin/sh\necho {env['_home']}/Bureau\n")
    run(env)
    assert icon(env, "Bureau").exists()


def test_python_wrapper(env, monkeypatch):
    for k, v in env.items():
        if not k.startswith("_"):
            monkeypatch.setenv(k, v)
    monkeypatch.delenv("XDG_DATA_HOME", raising=False)
    assert shortcut.has_shortcut() is False
    assert shortcut.install_shortcut(script=SCRIPT) is True
    assert shortcut.has_shortcut() is True
    assert shortcut.install_shortcut(script=env["_home"] / "missing") is False
