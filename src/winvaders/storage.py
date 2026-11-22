import json
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path

log = logging.getLogger("winvaders")

VERSION = 1
MAX_SCORES = 10
MAX_NAME = 12
SAVE_MINIMUMS = {"level": 1, "score": 0, "lives": 1, "next_life": 1, "seed": None}
DEFAULT_SETTINGS = {"sound": True, "music": True, "fullscreen": False, "last_name": ""}


def data_dir() -> Path:
    base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local/share")
    return Path(base) / "winvaders"


def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _clean_name(name: str) -> str:
    name = "".join(ch for ch in name if not 0xD800 <= ord(ch) <= 0xDFFF)
    return name.strip()[:MAX_NAME] or "PLAYER"


class Storage:
    def __init__(self, base_dir: Path | None = None):
        self.base = Path(base_dir) if base_dir else data_dir()

    def _read(self, name: str):
        path = self.base / name
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None
        except (OSError, ValueError, RecursionError) as e:
            log.warning("ignoring unreadable %s: %s", path, e)
            return None
        if not isinstance(data, dict) or data.get("version") != VERSION:
            log.warning("ignoring %s with unexpected format", path)
            return None
        return data

    def _write(self, name: str, data: dict) -> None:
        payload = json.dumps({**data, "version": VERSION}, ensure_ascii=False, indent=2)
        tmp = None
        try:
            self.base.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                "w", dir=self.base, suffix=".tmp", delete=False, encoding="utf-8"
            ) as f:
                tmp = f.name
                f.write(payload)
            os.replace(tmp, self.base / name)
        except (OSError, ValueError) as e:
            log.warning("could not write %s: %s", self.base / name, e)
            if tmp:
                Path(tmp).unlink(missing_ok=True)

    def load_save(self) -> dict | None:
        data = self._read("save.json")
        if data is None:
            return None
        for key, minimum in SAVE_MINIMUMS.items():
            value = data.get(key)
            if not _is_int(value) or (minimum is not None and value < minimum):
                return None
        return {k: data[k] for k in SAVE_MINIMUMS}

    def write_save(self, data: dict) -> None:
        self._write("save.json", {k: int(data[k]) for k in SAVE_MINIMUMS})

    def clear_save(self) -> None:
        try:
            (self.base / "save.json").unlink(missing_ok=True)
        except OSError as e:
            log.warning("could not remove save: %s", e)

    def has_save(self) -> bool:
        return self.load_save() is not None

    def load_scores(self) -> list[dict]:
        data = self._read("scores.json")
        if data is None or not isinstance(data.get("scores"), list):
            return []
        valid = [
            e for e in data["scores"]
            if isinstance(e, dict)
            and isinstance(e.get("name"), str)
            and _is_int(e.get("score"))
            and _is_int(e.get("level"))
            and isinstance(e.get("date"), str)
        ]
        return sorted(valid, key=lambda e: (-e["score"], e["date"]))[:MAX_SCORES]

    def qualifies(self, score: int) -> bool:
        if score <= 0:
            return False
        scores = self.load_scores()
        return len(scores) < MAX_SCORES or score > scores[-1]["score"]

    def add_score(self, name: str, score: int, level: int, date: str | None = None) -> int:
        if not self.qualifies(score):
            return -1
        entry = {
            "name": _clean_name(name),
            "score": int(score),
            "level": int(level),
            "date": date or datetime.now().isoformat(timespec="seconds"),
        }
        scores = self.load_scores() + [entry]
        scores.sort(key=lambda e: (-e["score"], e["date"]))
        scores = scores[:MAX_SCORES]
        self._write("scores.json", {"scores": scores})
        return next((i for i, e in enumerate(scores) if e is entry), -1)

    def load_settings(self) -> dict:
        data = self._read("settings.json") or {}
        return {k: data[k] if isinstance(data.get(k), type(v)) else v for k, v in DEFAULT_SETTINGS.items()}

    def save_settings(self, settings: dict) -> None:
        merged = {**self.load_settings(), **{k: v for k, v in settings.items() if k in DEFAULT_SETTINGS}}
        self._write("settings.json", merged)
