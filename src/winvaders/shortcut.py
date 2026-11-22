import logging
import shutil
import subprocess
from pathlib import Path

log = logging.getLogger("winvaders")

SCRIPT = Path("/usr/lib/winvaders/winvaders-shortcut")


def desktop_dir() -> Path:
    if shutil.which("xdg-user-dir"):
        try:
            out = subprocess.run(
                ["xdg-user-dir", "DESKTOP"], capture_output=True, text=True, timeout=5
            ).stdout.strip()
            if out:
                return Path(out)
        except (OSError, subprocess.SubprocessError) as e:
            log.warning("xdg-user-dir failed: %s", e)
    return Path.home() / "Desktop"


def has_shortcut() -> bool:
    return (desktop_dir() / "winvaders.desktop").exists()


def install_shortcut(script: Path = SCRIPT) -> bool:
    try:
        subprocess.run([str(script), "--force"], timeout=10, check=False)
    except (OSError, subprocess.SubprocessError) as e:
        log.warning("could not run %s: %s", script, e)
        return False
    return has_shortcut()
