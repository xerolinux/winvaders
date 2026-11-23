import pytest
from PySide6.QtCore import QObject

from winvaders.app import StorageBridge, create_engine
from winvaders.storage import Storage


@pytest.fixture
def engine(qapp, tmp_path, monkeypatch):
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    eng = create_engine(qapp)
    yield eng
    for root in eng.rootObjects():
        root.close()
    eng.deleteLater()
    qapp.processEvents()


def window(engine):
    roots = engine.rootObjects()
    assert len(roots) == 1
    return roots[0]


def test_main_qml_loads_without_warnings(engine, qapp):
    qapp.processEvents()
    assert len(engine.rootObjects()) == 1
    assert engine.qml_warnings == []


def test_window_defaults(engine):
    w = window(engine)
    assert w.width() == 1280
    assert w.height() == 720
    assert w.minimumWidth() == 960
    assert w.minimumHeight() == 540
    assert w.title() == "WinVaders"


def test_stage_letterbox(engine, qapp):
    w = window(engine)
    stage = w.findChild(QObject, "stage")
    w.resize(2560, 1080)
    qapp.processEvents()
    assert stage.property("scale") == pytest.approx(1.5)
    w.resize(960, 540)
    qapp.processEvents()
    assert stage.property("scale") == pytest.approx(0.75)


def test_screens_switch_without_warnings(engine, qapp):
    w = window(engine)
    for screen in ("scores", "name", "menu"):
        w.setProperty("screen", screen)
        qapp.processEvents()
    assert engine.qml_warnings == []


def test_bridge_roundtrip(tmp_path):
    bridge = StorageBridge(Storage(tmp_path))
    assert bridge.hasSave() is False
    assert bridge.loadSave() == {}
    assert bridge.addScore("bob", 500, 3) == 0
    assert bridge.scores()[0]["name"] == "bob"
    assert bridge.qualifies(10) is True
    bridge.setSetting("sound", False)
    assert bridge.settings()["sound"] is False
    bridge.writeSave({"level": 2, "score": 10, "lives": 3, "next_life": 10000, "seed": 5})
    assert bridge.loadSave()["level"] == 2
    bridge.clearSave()
    assert bridge.hasSave() is False


def test_menu_shows_credit(engine):
    w = window(engine)
    credit = w.findChild(QObject, "credit")
    assert credit is not None
    assert credit.property("text") == "Inspired by: <b>RandyPinball</b>"
    assert credit.property("visible") is True


def press(qapp, w, key, repeat):
    from PySide6.QtCore import QEvent, Qt
    from PySide6.QtGui import QKeyEvent

    text = {Qt.Key_Space: " ", Qt.Key_Return: "\r", Qt.Key_Escape: "\x1b", Qt.Key_N: "n"}.get(key, "")
    qapp.sendEvent(w, QKeyEvent(QEvent.KeyPress, key, Qt.NoModifier, text, repeat))
    qapp.processEvents()


@pytest.mark.parametrize("key_name", ["Key_Space", "Key_Return", "Key_Escape"])
def test_autorepeat_does_not_skip_screens(engine, qapp, key_name):
    from PySide6.QtCore import Qt

    key = getattr(Qt, key_name)
    w = window(engine)
    w.show()
    w.setProperty("screen", "scores")
    qapp.processEvents()
    press(qapp, w, key, True)
    assert w.property("screen") == "scores"
    press(qapp, w, key, False)
    assert w.property("screen") == "menu"
    press(qapp, w, key, True)
    assert w.property("screen") == "menu"


def test_autorepeat_does_not_type_into_name(engine, qapp):
    from PySide6.QtCore import Qt

    w = window(engine)
    w.show()
    w.setProperty("screen", "name")
    qapp.processEvents()
    entry_input = w.findChild(QObject, "nameInput")
    before = entry_input.property("text")
    press(qapp, w, Qt.Key_Space, True)
    press(qapp, w, Qt.Key_Return, True)
    assert entry_input.property("text") == before
    assert w.property("screen") == "name"


def _wait_playing(qapp, music, want=True):
    import time

    end = time.monotonic() + 15
    while music.isPlaying() != want and time.monotonic() < end:
        qapp.processEvents()
        time.sleep(0.01)
    return music.isPlaying()


def test_menu_has_music_toggle(engine, qapp):
    from PySide6.QtCore import Qt

    w = window(engine)
    w.show()
    menu = w.findChild(QObject, "menu")
    labels = lambda: [e["label"] for e in menu.property("entries").toVariant()]
    assert "MUSIC: ON" in labels()
    assert labels().index("MUSIC: ON") == labels().index("SOUND: ON") + 1
    press(qapp, w, Qt.Key_N, False)
    assert w.property("settings")["music"] is False
    assert "MUSIC: OFF" in labels()


def test_music_toggle_resumes_current_screen_track(engine, qapp):
    from PySide6.QtCore import Qt

    w = window(engine)
    w.show()
    music = engine.music
    assert music.current == "menu"
    assert _wait_playing(qapp, music)
    press(qapp, w, Qt.Key_N, False)
    assert not music.isPlaying()
    press(qapp, w, Qt.Key_N, False)
    assert music.current == "menu"
    assert _wait_playing(qapp, music)


def test_menu_offers_update_when_available(engine, qapp):
    from PySide6.QtCore import Qt

    w = window(engine)
    w.show()
    menu = w.findChild(QObject, "menu")
    labels = lambda: [e["label"] for e in menu.property("entries").toVariant()]
    assert not any(l.startswith("UPDATE") for l in labels())
    calls = []
    engine.updater.fetch = lambda url, done: calls.append(url)
    engine.updater.assets = ("image-url", "sha-url")
    engine.updater._latest = "9.9.9"
    engine.updater.set_state("available")
    assert labels()[0] == "UPDATE TO v9.9.9"
    menu.setProperty("current", 0)
    press(qapp, w, Qt.Key_Return, False)
    assert calls == ["sha-url"]
    assert labels()[0] == "DOWNLOADING UPDATE..."
    engine.updater.set_state("failed")
    assert labels()[0] == "UPDATE FAILED - RETRY"


def test_desktop_shortcut_entry_hidden_without_helper(engine, monkeypatch):
    from winvaders import shortcut

    monkeypatch.setattr(shortcut, "SCRIPT", shortcut.SCRIPT.with_name("missing-helper"))
    assert engine.bridge.canAddDesktopShortcut() is False
