import math
import random
import struct
import sys
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parent.parent / "src/winvaders/sounds"

WAVES = {
    "square": lambda p: 1.0 if (p % 1.0) < 0.5 else -1.0,
    "saw": lambda p: 2.0 * (p % 1.0) - 1.0,
    "sine": lambda p: math.sin(2 * math.pi * p),
}


def tone(dur, f0, f1, shape="square", vol=0.4, noise=0.0, seed=1, vibrato=0.0, tremolo=0.0, attack=0.0):
    rng = random.Random(seed)
    n = int(RATE * dur)
    phase = 0.0
    out = []
    for i in range(n):
        t = i / n
        sec = i / RATE
        freq = (f0 + (f1 - f0) * t) * (1 + vibrato * math.sin(2 * math.pi * 7 * sec))
        phase += freq / RATE
        s = WAVES[shape](phase) * (1 - noise) + rng.uniform(-1, 1) * noise
        env = (1 - t) if attack == 0 else min(1.0, t / attack) * (1 - t)
        if tremolo:
            env *= 1 - tremolo * (0.5 + 0.5 * math.sin(2 * math.pi * 11 * sec))
        out.append(s * vol * env)
    return out


def mix(*tracks):
    length = max(len(t) for t in tracks)
    return [sum(t[i] for t in tracks if i < len(t)) for i in range(length)]


def arpeggio(notes, step, vol=0.35, shape="square"):
    out = []
    for f in notes:
        out += tone(step, f, f, shape=shape, vol=vol)
    return out


def growl(dur, f0, f1, seed):
    return mix(
        tone(dur, f0, f1, shape="saw", vol=0.55, noise=0.25, seed=seed, vibrato=0.08, tremolo=0.6, attack=0.08),
        tone(dur, f0 / 2, f1 / 2, shape="square", vol=0.3, seed=seed + 1, vibrato=0.05, attack=0.1),
    )


SOUNDS = {
    "shoot": lambda: tone(0.12, 1400, 500, vol=0.22),
    "hit": lambda: tone(0.07, 900, 600, vol=0.3, noise=0.2),
    "kill": lambda: mix(tone(0.25, 700, 90, vol=0.35), tone(0.25, 300, 60, noise=0.9, vol=0.4, seed=7)),
    "bosshit": lambda: tone(0.12, 160, 70, shape="sine", noise=0.35, vol=0.6, seed=9),
    "bossdeath": lambda: mix(growl(1.6, 150, 45, 11), tone(1.6, 200, 30, noise=1.0, vol=0.35, seed=12)),
    "boss": lambda: growl(1.1, 70, 120, 5),
    "playerhit": lambda: tone(0.6, 400, 60, noise=0.5, vol=0.5, seed=3),
    "levelup": lambda: arpeggio([523, 659, 784, 1047], 0.09),
    "powerup": lambda: arpeggio([880, 1175, 1568], 0.07, vol=0.3),
    "extralife": lambda: arpeggio([784, 988, 1175, 1568, 1976], 0.08, vol=0.3),
    "gameover": lambda: arpeggio([392, 349, 311, 262, 196], 0.22, vol=0.35, shape="saw"),
}


def generate(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, make in SOUNDS.items():
        path = out_dir / f"{name}.wav"
        samples = make()
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))
        paths.append(path)
    return paths


if __name__ == "__main__":
    for p in generate(Path(sys.argv[1]) if len(sys.argv) > 1 else OUT):
        print(p)
