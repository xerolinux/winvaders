import logging
import wave
from pathlib import Path

from PySide6.QtCore import QBuffer, QByteArray, QIODevice, QObject, Slot
from PySide6.QtMultimedia import QAudio, QAudioFormat, QAudioSink, QMediaDevices

log = logging.getLogger("winvaders")

SOUNDS_DIR = Path(__file__).resolve().parent / "sounds"
MAX_VOICES = 8


# QML's SoundEffect tags its stream media.role=event, which PipeWire treats as a
# notification sound: muted whenever the desktop mutes notifications. QAudioSink
# streams are tagged as music, so game sounds follow the normal volume.
class SoundBoard(QObject):
    def __init__(self, sounds_dir: Path = SOUNDS_DIR, parent: QObject | None = None):
        super().__init__(parent)
        self.enabled = True
        self.clips: dict[str, bytes] = {}
        self.voices: list[tuple[QAudioSink, QBuffer]] = []
        self.format = QAudioFormat()
        self.format.setSampleRate(22050)
        self.format.setChannelCount(1)
        self.format.setSampleFormat(QAudioFormat.Int16)
        for path in sorted(Path(sounds_dir).glob("*.wav")):
            try:
                with wave.open(str(path)) as w:
                    self.clips[path.stem] = w.readframes(w.getnframes())
            except (OSError, wave.Error) as e:
                log.warning("skipping sound %s: %s", path, e)

    def names(self) -> list[str]:
        return list(self.clips)

    @Slot(bool)
    def setEnabled(self, enabled):
        self.enabled = bool(enabled)

    @Slot(str, result=bool)
    def play(self, name):
        clip = self.clips.get(name)
        if not self.enabled or clip is None or len(self.voices) >= MAX_VOICES:
            return False
        sink = QAudioSink(QMediaDevices.defaultAudioOutput(), self.format, self)
        sink.setVolume(0.7)
        buffer = QBuffer(self)
        buffer.setData(QByteArray(clip))
        buffer.open(QIODevice.ReadOnly)
        self.voices.append((sink, buffer))
        sink.stateChanged.connect(self._on_state)
        sink.start(buffer)
        return True

    @Slot(QAudio.State)
    def _on_state(self, state):
        if state not in (QAudio.State.IdleState, QAudio.State.StoppedState):
            return
        sink = self.sender()
        for voice in self.voices:
            if voice[0] is sink:
                self.voices.remove(voice)
                voice[0].deleteLater()
                voice[1].deleteLater()
                return
