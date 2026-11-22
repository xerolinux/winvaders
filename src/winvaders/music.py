import heapq
import itertools
import math
import random
import re
import threading
from array import array
from functools import lru_cache
from typing import NamedTuple

from PySide6.QtCore import QIODevice, QObject, Qt, Signal, Slot
from PySide6.QtMultimedia import QAudioFormat, QAudioSink, QMediaDevices, QtAudio

RATE = 22050
BPM = 128
BARS = 16
STEPS = BARS * 16
LOOP_SAMPLES = RATE * 60 * 4 * BARS // BPM
MENU_VOLUME = 0.12
GAME_VOLUME = 0.2

LEAD_LEVEL = 0.2
BASS_LEVEL = 0.3
KICK_LEVEL = 0.22
SNARE_LEVEL = 0.15
HAT_LEVEL = 0.06

_NOTE = re.compile(r"([a-g])(#?)(\d)(?::(\d+))?$")
_SEMITONE = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}
_BASS_OFFSET = {"r": 0, "f": 7, "o": 12}

_BASS_STYLES = {
    "pump": "r-r-r-r-r-r-r-r-",
    "rolling": "rro-rro-rro-rro-",
    "sparse": "r=======r===o===",
    "sync": "r--r--r-r--r--r-",
    "walk": "r=f=o=f=r=f=o=f=",
    "off": "-r-r-r-r-r-r-r-r",
    "gallop": "r-rrr-rrr-rrr-rr",
    "oct": "rorororororororo",
    "arp": "r-f-o-f-r-f-o-f-",
}

_PASSES = ((0, 1, 2, 3), (0, 1, 2, 4), (None, None, 2, 3), (0, 1, 2, 4))
_CALM_PASSES = ((0, 1, 2, 3), (0, 1, 2, 4), (0, 1, 2, 3), (0, 1, 2, 4))


class Song(NamedTuple):
    lead: list[tuple[int, int, int]]
    bass: list[tuple[int, int, int]]
    drums: list[tuple[int, tuple[str, ...]]]


def _midi(name: str) -> int:
    m = _NOTE.match(name)
    return 12 * (int(m[3]) + 1) + _SEMITONE[m[1]] + (1 if m[2] else 0)


def _lead_bar(text: str) -> list[tuple[int, int, int]]:
    events, step = [], 0
    for token in text.split():
        name, _, length = token.partition(":")
        length = int(length or 1)
        if name != "r":
            events.append((step, _midi(name), length))
        step += length
    assert step == 16, f"bar is {step} steps: {text}"
    return events


def _bass_bar(style: str, root: int) -> list[tuple[int, int, int]]:
    pattern = _BASS_STYLES[style]
    assert len(pattern) == 16
    events = []
    for i, c in enumerate(pattern):
        if c in _BASS_OFFSET:
            length = 1
            while i + length < 16 and pattern[i + length] == "=":
                length += 1
            events.append((i, root + _BASS_OFFSET[c], length))
    return events


def _compose(roots, lead, bass, drums, calm=False) -> Song:
    root_notes = [_midi(r) for r in roots.split()]
    bars = [_lead_bar(b) for b in lead.split("|")]
    lead_events, bass_events, drum_events = [], [], []
    for p, plan in enumerate(_CALM_PASSES if calm else _PASSES):
        for i, bar in enumerate(plan):
            base = (p * 4 + i) * 16
            if bar is not None:
                lead_events += [(base + s, m, n) for s, m, n in bars[bar]]
            bass_events += [(base + s, m, n) for s, m, n in _bass_bar(bass, root_notes[i])]
            for s in range(16):
                if i == 3 and s >= 12 and not calm:
                    kinds = ("snare",)
                else:
                    kinds = tuple(k for k, pat in zip(("kick", "snare", "hat"), drums) if pat[s] == "x")
                if kinds:
                    drum_events.append((base + s, kinds))
    return Song(lead_events, bass_events, drum_events)


def _spec(roots, bass, drums, lead, calm=False):
    return _compose(roots, lead, bass, drums.split(), calm)


SONGS: dict[str, Song] = {
    "menu": _spec(
        "a2 f2 c3 g2", "sparse", "x.......x....... ................ ..x...x...x...x.",
        "a4:2 c5:2 e5:2 c5:2 a4:2 c5:2 e5:2 c5:2 | f4:2 a4:2 c5:2 a4:2 f4:2 a4:2 c5:2 a4:2"
        " | c5:2 e5:2 g5:2 e5:2 c5:2 e5:2 g5:2 e5:2 | g4:2 b4:2 d5:2 b4:2 g4:2 b4:2 d5:2 b4:2"
        " | g4:2 d5:2 g5:4 d5:2 b4:2 g4:4",
        calm=True,
    ),
    "level": _spec(
        "a2 c3 f2 g2", "rolling", "x...x...x...x... ....x.......x... x.x.x.x.x.x.x.x.",
        "e5:2 r:2 e5:2 d5:2 c5:4 r:4 | c5:2 r:2 c5:2 d5:2 e5:4 r:4 | a4:2 r:2 a4:2 c5:2 f5:4 r:4"
        " | g4:2 r:2 g4:2 b4:2 d5:4 r:4 | d5:2 b4:2 g4:2 b4:2 d5:4 g5:4",
    ),
    "clippy": _spec(
        "a2 f2 c3 g2", "pump", "x...x...x...x... ....x.......x... x.x.x.x.x.x.x.x.",
        "a4 r a4 c5 r e5:2 c5 r a4 r c5:2 a4:3 | f4 r f4 a4 r c5:2 a4 r f4 r a4:2 f4:3"
        " | g4 r g4 c5 r e5:2 c5 r g4 r e5:2 c5:3 | g4 r g4 b4 r d5:2 b4 r g4 r d5:2 g4:3"
        " | g4 b4 d5 g5 d5 b4 g4 r d5:2 b4:2 g4:4",
    ),
    "cortanaboss": _spec(
        "a2 e3 f2 c3", "sparse", "x.......x..x.... ........x....... ..x...x...x...x.",
        "e5:4 a5:4 g5:2 e5:2 c5:4 | e5:4 g5:4 b5:4 g5:2 e5:2 | a5:4 f5:4 c5:4 a4:4"
        " | g5:4 e5:4 c5:2 e5:2 g5:4 | c6:2 b5:2 g5:2 e5:2 d5:4 c5:4",
    ),
    "zune": _spec(
        "a2 a2 d3 e3", "sync", "x..x..x...x..x.. ....x.......x... x.x.x.x.x.x.x.xx",
        "a4:2 r c5:2 r e5 d5 c5 r a4:2 r g4 a4:2 | e5:2 r e5 d5 c5:2 r a4 c5 d5 e5:2 r g5:2"
        " | d5:2 r f5:2 r a5 g5 f5 r d5:2 r e5 f5:2 | e5:2 r g5 e5 b4:2 r e5 g5 b5:4 r:2"
        " | e5 g5 b5 g5 e5 g5 b5 g5 e5:2 r:2 b4:4",
    ),
    "bsod": _spec(
        "a2 g2 f2 e2", "oct", "x.x...x.x.x...x. ....x.......x..x xxxxxxxxxxxxxxxx",
        "a5 a5 a5 r e5 e5 e5 r c5 c5 c5 r a4:4 | g5 g5 g5 r d5 d5 d5 r b4 b4 b4 r g4:4"
        " | f5 f5 f5 r c5 c5 c5 r a4 a4 a4 r f4:4 | e5 e5 e5 r b4 b4 b4 r g4 g4 g4 r e4:4"
        " | e5 d5 c5 b4 a4 g4 f4 e4 r:4 e4:4",
    ),
    "ieboss": _spec(
        "a2 c3 d3 e3", "walk", "x.......x.x..... ........x....... x...x...x...x...",
        "a4:6 c5:2 e5:6 c5:2 | c5:6 e5:2 g5:6 e5:2 | d5:6 f5:2 a5:6 f5:2 | e5:6 g5:2 b5:6 g5:2"
        " | b5:2 g5:2 e5:2 g5:2 b5:4 e5:4",
    ),
    "bob": _spec(
        "a2 d3 a2 e3", "off", "x.......x....... ....x.......x... x.x.x.x.x.x.x.x.",
        "a4:2 e5:2 a5:2 e5:2 c5:2 e5:2 a4:4 | d5:2 a5:2 f5:2 a5:2 d5:2 f5:2 d5:4"
        " | e5:2 c5:2 a4:2 c5:2 e5:4 a4:4 | g5:2 e5:2 b4:2 e5:2 g5:2 b5:2 e5:4"
        " | e5:2 g5:2 b5:2 g5:2 e5:8",
    ),
    "redring": _spec(
        "a2 a2 f2 g2", "gallop", "x...x...x..xx... ....x.......x... .x.x.x.x.x.x.x.x",
        "a5:2 a5:2 a5:2 r:2 e5:2 e5:2 e5:2 r:2 | c6:2 c6:2 c6:2 r:2 a5:2 a5:2 a5:2 r:2"
        " | a5:2 a5:2 a5:2 r:2 f5:2 f5:2 f5:2 r:2 | b5:2 b5:2 b5:2 r:2 g5:2 g5:2 g5:2 r:2"
        " | g5 g5 g5 r g5 g5 g5 r d5:2 g5:2 b5:4",
    ),
    "teamsboss": _spec(
        "f2 g2 a2 e2", "arp", "x...x...x...x... ....x.......x... x.x.x.x.x.x.x.xx",
        "f5 a5 c6 a5 f5 a5 c6 a5 f5 a5 c6 a5 f5:4 | g5 b5 d6 b5 g5 b5 d6 b5 g5 b5 d6 b5 g5:4"
        " | a5 c6 e6 c6 a5 c6 e6 c6 a5 c6 e6 c6 a5:4 | e5 g5 b5 g5 e5 g5 b5 g5 e5 g5 b5 g5 e5:4"
        " | e5 g5 b5 e6 b5 g5 e5 g5 b5:4 e5:4",
    ),
    "winupdate": _spec(
        "a2 f2 a2 g2", "pump", "x...x...x...x... ...............x x.x.x.x.x.x.x.x.",
        "a4:2 b4:2 c5:2 d5:2 e5:2 r:2 e5:4 | f4:2 g4:2 a4:2 b4:2 c5:2 r:2 c5:4"
        " | a4:2 c5:2 e5:2 c5:2 a4:2 r:2 a4:4 | g4:2 a4:2 b4:2 d5:2 g5:2 r:2 g5:4"
        " | g5:2 f5:2 e5:2 d5:2 c5:2 b4:2 a4:4",
    ),
    "kinect": _spec(
        "a2 g2 c3 e2", "off", "x..x....x..x.... ....x.......x... x.xxx.xxx.xxx.xx",
        "a4 c5 e5 a5 e5 c5 a4 r a4 c5 e5 a5 e5 c5 a4 r | g4 b4 d5 g5 d5 b4 g4 r g4 b4 d5 g5 d5 b4 g4 r"
        " | c5 e5 g5 c6 g5 e5 c5 r c5 e5 g5 c6 g5 e5 c5 r | e4 g4 b4 e5 b4 g4 e4 r e4 g4 b4 e5 b4 g4 e4 r"
        " | e4 g4 b4 e5 g5 b5 e6 r:3 e6:4 b5:2",
    ),
    "uac": _spec(
        "a2 f2 e2 e2", "sparse", "x.......x.x..... ....x.......x... x...x...x...x...",
        "a4:2 r:2 a4:2 r:2 c5:4 r:4 | f4:2 r:2 f4:2 r:2 a4:4 r:4 | e4:2 r:2 e4:2 r:2 g4:4 r:4"
        " | e5:2 d5:2 c5:2 b4:2 b4:8 | e5:2 e5:2 e5:2 e5:2 b4:2 b4:2 e4:4",
    ),
    "copilotboss": _spec(
        "f2 c3 g2 a2", "rolling", "x..x..x...x.x... ....x.......x..x x.x.x.x.xxx.x.x.",
        "a4:2 c5:2 f5:3 e5 c5:2 a4:2 c5:4 | g4:2 c5:2 e5:3 d5 c5:2 g4:2 e5:4"
        " | b4:2 d5:2 g5:3 e5 d5:2 b4:2 d5:4 | c5:2 e5:2 a5:3 g5 e5:2 c5:2 a5:4"
        " | a5:2 g5:2 e5:2 c5:2 e5:2 a4:2 a4:4",
    ),
}


def _lowpass(samples: list[float], a: float) -> list[float]:
    y, out = 0.0, []
    for x in samples:
        y += a * (x - y)
        out.append(y)
    return out


def _envelope(n: int) -> list[float]:
    release = max(1, min(1500, n // 2))
    return [
        min(1.0, i / 40) * min(1.0, (n - i) / release) * (1 - 0.3 * i / n)
        for i in range(n)
    ]


@lru_cache(maxsize=None)
def _note_wave(inst: str, midi: int, n: int) -> array:
    step = 440 * 2 ** ((midi - 69) / 12) / RATE
    phases = [(i * step) % 1 for i in range(n)]
    if inst == "lead":
        raw = _lowpass([1.0 if p < 0.25 else -1.0 for p in phases], 0.5)
        level = LEAD_LEVEL
    else:
        raw = [1 - 4 * abs(p - 0.5) for p in phases]
        level = BASS_LEVEL
    amp = level * 32767
    return array("h", [int(amp * x * e) for x, e in zip(raw, _envelope(n))])


@lru_cache(maxsize=None)
def _drum_hit(kind: str) -> list[float]:
    rng = random.Random(kind)
    if kind == "kick":
        n, phase, out = 2400, 0.0, []
        for i in range(n):
            phase += (45 + 110 * math.exp(-i / 350)) / RATE
            out.append(math.sin(2 * math.pi * phase) * math.exp(-i / 700) * KICK_LEVEL)
        return out
    if kind == "snare":
        return [
            (rng.uniform(-1, 1) * 0.8 + math.sin(2 * math.pi * 190 * i / RATE) * 0.4)
            * math.exp(-i / 600) * SNARE_LEVEL
            for i in range(2200)
        ]
    noise = [rng.uniform(-1, 1) for _ in range(1201)]
    return [(noise[i + 1] - noise[i]) * 0.5 * math.exp(-i / 250) * HAT_LEVEL for i in range(1200)]


@lru_cache(maxsize=None)
def _drum_wave(kinds: tuple[str, ...]) -> array:
    hits = [_drum_hit(k) for k in kinds]
    n = max(len(h) for h in hits)
    return array("h", [int(32767 * sum(h[i] for h in hits if i < len(h))) for i in range(n)])


def _place(stem: array, start: int, wave: array) -> None:
    end = min(start + len(wave), LOOP_SAMPLES)
    stem[start:end] = wave[: end - start]


def _position(step: int) -> int:
    return round(step * LOOP_SAMPLES / STEPS)


def _render_notes(inst: str, events) -> array:
    stem = array("h", bytes(2 * LOOP_SAMPLES))
    for step, midi, length in events:
        start = _position(step)
        _place(stem, start, _note_wave(inst, midi, _position(step + length) - start))
    return stem


def render_stems(name: str) -> dict[str, array]:
    song = SONGS[name]
    drums = array("h", bytes(2 * LOOP_SAMPLES))
    for step, kinds in song.drums:
        _place(drums, _position(step), _drum_wave(kinds))
    return {
        "lead": _render_notes("lead", song.lead),
        "bass": _render_notes("bass", song.bass),
        "drums": drums,
    }


def mix(stems: list[array]) -> bytes:
    total = [sum(parts) for parts in zip(*stems)]
    if max(total) > 32767 or min(total) < -32768:
        total = [max(-32768, min(32767, t)) for t in total]
    return array("h", total).tobytes()


def _track(name: str, stems_of) -> bytes:
    body, _, guest = name.partition("+")
    if not guest:
        stems = stems_of(body)
        return mix([stems["lead"], stems["bass"], stems["drums"]])
    a, b = stems_of(body), stems_of(guest)
    return mix([a["lead"], b["bass"], b["drums"]])


def track_bytes(name: str) -> bytes:
    return _track(name, render_stems)


class LoopDevice(QIODevice):
    def __init__(self, data: bytes, parent: QObject | None = None):
        super().__init__(parent)
        self._data = data
        self._pos = 0

    def isSequential(self):
        return True

    def bytesAvailable(self):
        return len(self._data) + super().bytesAvailable()

    def readData(self, maxlen):
        size = len(self._data)
        out = bytearray()
        while len(out) < maxlen:
            chunk = self._data[self._pos : self._pos + maxlen - len(out)]
            out += chunk
            self._pos = (self._pos + len(chunk)) % size
        return bytes(out)

    def writeData(self, data, maxlen):
        return -1


def _valid(name: str) -> bool:
    parts = name.split("+")
    return len(parts) <= 2 and all(p in SONGS for p in parts)


class MusicPlayer(QObject):
    _ready = Signal(str)

    def __init__(self, parent: QObject | None = None):
        super().__init__(parent)
        self.current = ""
        self.paused = False
        self.enabled = True
        self._tracks: dict[str, bytes] = {}
        self._stems: dict[str, dict[str, array]] = {}
        self._sink: QAudioSink | None = None
        self._device: LoopDevice | None = None
        self._jobs: list[tuple[int, int, str]] = []
        self._order = itertools.count()
        self._lock = threading.Lock()
        self._worker_alive = False
        self._format = QAudioFormat()
        self._format.setSampleRate(RATE)
        self._format.setChannelCount(1)
        self._format.setSampleFormat(QAudioFormat.Int16)
        self._ready.connect(self._on_ready, Qt.QueuedConnection)
        for name in SONGS:
            self._submit(name, 1)

    def _submit(self, name: str, priority: int) -> None:
        with self._lock:
            heapq.heappush(self._jobs, (priority, next(self._order), name))
            if self._worker_alive:
                return
            self._worker_alive = True
        threading.Thread(target=self._work, daemon=True).start()

    def _stems_of(self, name: str) -> dict[str, array]:
        if name not in self._stems:
            self._stems[name] = render_stems(name)
        return self._stems[name]

    def _work(self) -> None:
        while True:
            with self._lock:
                if not self._jobs:
                    self._worker_alive = False
                    return
                name = heapq.heappop(self._jobs)[2]
            if name not in self._tracks:
                self._tracks[name] = _track(name, self._stems_of)
                self._ready.emit(name)

    @Slot(str)
    def _on_ready(self, name: str) -> None:
        if name == self.current and self._sink is None:
            self._start()

    def _start(self) -> None:
        data = self._tracks.get(self.current)
        if data is None or not self.enabled or self.paused:
            return
        self._device = LoopDevice(data, self)
        self._device.open(QIODevice.ReadOnly)
        self._sink = QAudioSink(QMediaDevices.defaultAudioOutput(), self._format, self)
        self._sink.setVolume(MENU_VOLUME if self.current == "menu" else GAME_VOLUME)
        self._sink.start(self._device)

    def _teardown(self) -> None:
        if self._sink is not None:
            self._sink.stop()
            self._sink.deleteLater()
            self._sink = None
        if self._device is not None:
            self._device.close()
            self._device.deleteLater()
            self._device = None

    @Slot(str, result=bool)
    def play(self, name):
        if not _valid(name):
            return False
        if name == self.current:
            return True
        self._teardown()
        self.current = name
        self.paused = False
        if name not in self._tracks:
            self._submit(name, 0)
        elif self.enabled:
            self._start()
        return True

    @Slot()
    def pause(self):
        self.paused = True
        if self._sink is not None:
            self._sink.suspend()

    @Slot()
    def resume(self):
        self.paused = False
        if self._sink is not None:
            self._sink.resume()
        elif self.current and self.enabled:
            self._start()

    @Slot()
    def stop(self):
        self._teardown()
        self.current = ""
        self.paused = False

    @Slot(bool)
    def setEnabled(self, enabled):
        self.enabled = bool(enabled)
        if not self.enabled:
            self._teardown()
        elif self.current and self._sink is None:
            self._start()

    @Slot(result=bool)
    def isPlaying(self):
        return self._sink is not None and self._sink.state() == QtAudio.State.ActiveState
