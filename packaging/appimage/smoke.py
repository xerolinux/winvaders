import os
import sys

os.environ["QT_QPA_PLATFORM"] = "offscreen"

from PySide6.QtGui import QGuiApplication

from winvaders.app import create_engine
from winvaders.gamepad import _load_sdl

app = QGuiApplication([])
engine = create_engine(app)
if not engine.rootObjects():
    sys.exit("\n".join(engine.qml_warnings) or "Main.qml failed to load")
_load_sdl()
print("smoke ok")
