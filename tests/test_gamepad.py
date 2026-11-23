import pytest
from PySide6.QtCore import QObject, Qt

from winvaders import gamepad
from winvaders.app import create_engine
from winvaders.gamepad import GamepadInput, key_for_button


def test_button_mapping_by_screen():
    assert key_for_button(gamepad.SOUTH, "game") == Qt.Key_Space
    assert key_for_button(gamepad.SOUTH, "menu") == Qt.Key_Return
    assert key_for_button(gamepad.EAST, "menu") is None
    assert key_for_button(gamepad.EAST, "scores") == Qt.Key_Escape
    assert key_for_button(gamepad.START, "game") == Qt.Key_Escape
    assert key_for_button(gamepad.START, "name") == Qt.Key_Return
    assert key_for_button(13, "game") == Qt.Key_Left


@pytest.fixture
def setup(qapp, tmp_path, monkeypatch):
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    engine = create_engine(qapp)
    window = engine.rootObjects()[0]
    window.requestActivate()
    qapp.processEvents()
    pad = GamepadInput(window, use_sdl=False)
    yield qapp, window, pad
    window.close()
    engine.deleteLater()
    qapp.processEvents()


def test_dpad_moves_menu_and_a_starts_game(setup):
    qapp, window, pad = setup
    menu = window.findChild(QObject, "menu")
    first = menu.property("current")
    pad.button(12, True)
    pad.button(12, False)
    assert menu.property("current") == first + 1
    pad.button(gamepad.EAST, True)
    pad.button(gamepad.EAST, False)
    assert window.property("screen") == "menu"


def test_stick_and_trigger_drive_game(setup):
    qapp, window, pad = setup
    window.setProperty("screen", "game")
    qapp.processEvents()
    game = window.findChild(QObject, "game")
    pad.axis(gamepad.AXIS_LEFTX, -30000)
    assert game.property("moveLeft") is True
    pad.axis(gamepad.AXIS_LEFTX, -12000)
    assert game.property("moveLeft") is True
    pad.axis(gamepad.AXIS_LEFTX, 0)
    assert game.property("moveLeft") is False
    pad.axis(gamepad.AXIS_RIGHT_TRIGGER, 32000)
    assert game.property("fireHeld") is True
    pad.release_all()
    assert game.property("fireHeld") is False


def test_name_entry_letter_picker(setup):
    qapp, window, pad = setup
    window.setProperty("finalScore", 999)
    window.setProperty("screen", "name")
    qapp.processEvents()
    name = window.findChild(QObject, "nameInput")
    name.setProperty("text", "")
    for b in (11, 11, 14, 12):
        pad.button(b, True)
        pad.button(b, False)
    assert name.property("text") == "B9"
    pad.button(13, True)
    pad.button(13, False)
    assert name.property("text") == "B"


def test_bundled_sdl_path_wins(monkeypatch):
    from winvaders import gamepad

    monkeypatch.setenv("WINVADERS_SDL", "/app/usr/lib/libSDL3.so.0")
    assert gamepad.sdl_library() == "/app/usr/lib/libSDL3.so.0"
    monkeypatch.delenv("WINVADERS_SDL")
    assert gamepad.sdl_library() in ("libSDL3.so.0", gamepad.ctypes.util.find_library("SDL3"))
