import importlib.util
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMES = {"shoot", "hit", "kill", "bosshit", "bossdeath", "boss", "playerhit", "levelup", "powerup", "extralife", "gameover"}


def load_gen():
    spec = importlib.util.spec_from_file_location("gen_sounds", ROOT / "tools/gen_sounds.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def check_wavs(paths):
    assert {p.stem for p in paths} == NAMES
    for p in paths:
        with wave.open(str(p)) as w:
            assert w.getframerate() == 22050
            assert w.getnchannels() == 1
            assert w.getsampwidth() == 2
            assert 0 < w.getnframes() <= 22050 * 2


def test_generate_valid_wavs(tmp_path):
    check_wavs(load_gen().generate(tmp_path))


def test_shipped_sounds_present():
    check_wavs(sorted((ROOT / "src/winvaders/sounds").glob("*.wav")))
