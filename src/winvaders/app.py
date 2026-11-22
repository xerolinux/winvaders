import sys
from pathlib import Path

from PySide6.QtCore import QObject, QUrl, Slot
from PySide6.QtGui import QGuiApplication, QIcon
from PySide6.QtQml import QQmlApplicationEngine

from . import shortcut
from .audio import SoundBoard
from .music import MusicPlayer
from .storage import Storage

QML_DIR = Path(__file__).resolve().parent / "qml"


class StorageBridge(QObject):
    def __init__(self, storage: Storage | None = None, parent: QObject | None = None):
        super().__init__(parent)
        self.storage = storage or Storage()

    @Slot(result=bool)
    def hasSave(self):
        return self.storage.has_save()

    @Slot(result="QVariantMap")
    def loadSave(self):
        return self.storage.load_save() or {}

    @Slot("QVariantMap")
    def writeSave(self, data):
        self.storage.write_save(data)

    @Slot()
    def clearSave(self):
        self.storage.clear_save()

    @Slot(result="QVariantList")
    def scores(self):
        return self.storage.load_scores()

    @Slot(int, result=bool)
    def qualifies(self, score):
        return self.storage.qualifies(score)

    @Slot(str, int, int, result=int)
    def addScore(self, name, score, level):
        return self.storage.add_score(name, score, level)

    @Slot(result="QVariantMap")
    def settings(self):
        return self.storage.load_settings()

    @Slot(str, "QVariant")
    def setSetting(self, key, value):
        self.storage.save_settings({key: value})

    @Slot(result=bool)
    def addDesktopShortcut(self):
        return shortcut.install_shortcut()

    @Slot(result=bool)
    def hasDesktopShortcut(self):
        return shortcut.has_shortcut()


def create_engine(app: QGuiApplication) -> QQmlApplicationEngine:
    engine = QQmlApplicationEngine()
    engine.qml_warnings = []
    engine.warnings.connect(lambda ws: engine.qml_warnings.extend(w.toString() for w in ws))
    engine.bridge = StorageBridge(parent=engine)
    engine.rootContext().setContextProperty("Storage", engine.bridge)
    engine.sound = SoundBoard(parent=engine)
    engine.rootContext().setContextProperty("Sound", engine.sound)
    engine.music = MusicPlayer(parent=engine)
    engine.rootContext().setContextProperty("Music", engine.music)
    engine.load(QUrl.fromLocalFile(str(QML_DIR / "Main.qml")))
    return engine


def main() -> int:
    app = QGuiApplication(sys.argv)
    app.setApplicationName("WinVaders")
    app.setOrganizationName("XeroLinux")
    app.setDesktopFileName("winvaders")
    app.setWindowIcon(QIcon.fromTheme("winvaders"))
    engine = create_engine(app)
    if not engine.rootObjects():
        for w in engine.qml_warnings:
            print(w, file=sys.stderr)
        return 1
    return app.exec()
