import ctypes
import ctypes.util
import logging
import os

from PySide6.QtCore import QEvent, QObject, Qt, QTimer
from PySide6.QtGui import QGuiApplication, QKeyEvent

log = logging.getLogger("winvaders")

INIT_GAMEPAD = 0x2000
EV_AXIS, EV_DOWN, EV_UP, EV_ADDED, EV_REMOVED = 0x650, 0x651, 0x652, 0x653, 0x654
SOUTH, EAST, WEST, BACK, START = 0, 1, 2, 4, 6
DPAD = {11: Qt.Key_Up, 12: Qt.Key_Down, 13: Qt.Key_Left, 14: Qt.Key_Right}
AXIS_LEFTX, AXIS_LEFTY, AXIS_RIGHT_TRIGGER = 0, 1, 5
STICK_ON, STICK_OFF = 16000, 8000
TRIGGER_ON, TRIGGER_OFF = 12000, 6000


class _Event(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_uint32),
        ("reserved", ctypes.c_uint32),
        ("timestamp", ctypes.c_uint64),
        ("which", ctypes.c_uint32),
        ("code", ctypes.c_uint8),
        ("down", ctypes.c_uint8),
        ("pad1", ctypes.c_uint8),
        ("pad2", ctypes.c_uint8),
        ("value", ctypes.c_int16),
        ("pad3", ctypes.c_uint16),
        ("rest", ctypes.c_uint8 * 100),
    ]


def key_for_button(button: int, screen: str):
    if button in DPAD:
        return DPAD[button]
    if button in (SOUTH, WEST):
        return Qt.Key_Space if screen == "game" else Qt.Key_Return
    if button == EAST:
        return None if screen == "menu" else Qt.Key_Escape
    if button in (START, BACK):
        return Qt.Key_Escape if screen == "game" else Qt.Key_Return
    return None


def sdl_library() -> str:
    return os.environ.get("WINVADERS_SDL") or ctypes.util.find_library("SDL3") or "libSDL3.so.0"


def _load_sdl():
    sdl = ctypes.CDLL(sdl_library())
    sdl.SDL_SetHint.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
    sdl.SDL_Init.argtypes = [ctypes.c_uint32]
    sdl.SDL_Init.restype = ctypes.c_bool
    sdl.SDL_PollEvent.argtypes = [ctypes.POINTER(_Event)]
    sdl.SDL_PollEvent.restype = ctypes.c_bool
    sdl.SDL_OpenGamepad.argtypes = [ctypes.c_uint32]
    sdl.SDL_OpenGamepad.restype = ctypes.c_void_p
    sdl.SDL_CloseGamepad.argtypes = [ctypes.c_void_p]
    return sdl


class GamepadInput(QObject):
    """Turns SDL3 gamepad input into the key presses the QML screens already handle."""

    def __init__(self, window, parent: QObject | None = None, use_sdl: bool = True):
        super().__init__(parent)
        self.window = window
        self.held: dict[str, int] = {}
        self.pads: dict[int, int] = {}
        self.sdl = None
        if use_sdl:
            try:
                sdl = _load_sdl()
                # SDL owns no window here, so it would otherwise drop pad events as "background".
                sdl.SDL_SetHint(b"SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", b"1")
                if sdl.SDL_Init(INIT_GAMEPAD):
                    self.sdl = sdl
                else:
                    log.warning("SDL gamepad init failed; controller support off")
            except OSError as e:
                log.warning("SDL3 not available (%s); controller support off", e)
        if self.sdl:
            self.sdl_event = _Event()
            self.timer = QTimer(self)
            self.timer.timeout.connect(self.poll)
            self.timer.start(16)

    def poll(self):
        while self.sdl.SDL_PollEvent(ctypes.byref(self.sdl_event)):
            e = self.sdl_event
            if e.type == EV_ADDED:
                pad = self.sdl.SDL_OpenGamepad(e.which)
                if pad:
                    self.pads[e.which] = pad
            elif e.type == EV_REMOVED:
                pad = self.pads.pop(e.which, None)
                if pad:
                    self.sdl.SDL_CloseGamepad(pad)
                self.release_all()
            elif e.type in (EV_DOWN, EV_UP):
                self.button(e.code, e.type == EV_DOWN)
            elif e.type == EV_AXIS:
                self.axis(e.code, e.value)

    def screen(self) -> str:
        return self.window.property("screen") or ""

    def button(self, button: int, down: bool):
        self.set_source(f"b{button}", down, lambda: key_for_button(button, self.screen()))

    def axis(self, axis: int, value: int):
        if axis == AXIS_RIGHT_TRIGGER:
            self.threshold("rt", value, TRIGGER_ON, TRIGGER_OFF, Qt.Key_Space)
        elif axis == AXIS_LEFTX:
            self.threshold("left", -value, STICK_ON, STICK_OFF, Qt.Key_Left)
            self.threshold("right", value, STICK_ON, STICK_OFF, Qt.Key_Right)
        elif axis == AXIS_LEFTY:
            self.threshold("up", -value, STICK_ON, STICK_OFF, Qt.Key_Up)
            self.threshold("down", value, STICK_ON, STICK_OFF, Qt.Key_Down)

    def threshold(self, source: str, value: int, on: int, off: int, key):
        if source in self.held:
            if value < off:
                self.set_source(source, False, None)
        elif value > on:
            self.set_source(source, True, lambda: key)

    def set_source(self, source: str, down: bool, key_fn):
        if down:
            if source in self.held:
                return
            key = key_fn()
            if key is None:
                return
            self.held[source] = key
            self.send(QEvent.KeyPress, key)
        else:
            key = self.held.pop(source, None)
            if key is not None:
                self.send(QEvent.KeyRelease, key)

    def release_all(self):
        for source in list(self.held):
            self.set_source(source, False, None)

    def send(self, kind, key):
        QGuiApplication.sendEvent(self.window, QKeyEvent(kind, key, Qt.NoModifier))
