import os
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QJSEngine, QJSValue

QML_DIR = Path(__file__).resolve().parent.parent / "src/winvaders/qml"


@pytest.fixture(scope="session")
def qapp():
    return QGuiApplication.instance() or QGuiApplication([])


class JsModule:
    def __init__(self, engine: QJSEngine, module: QJSValue):
        self.engine = engine
        self.module = module

    def get(self, name):
        return self.module.property(name).toVariant()

    def call(self, name, *args):
        fn = self.module.property(name)
        result = fn.call([self.engine.toScriptValue(a) for a in args])
        if result.isError():
            raise RuntimeError(result.toString())
        return result.toVariant()

    def eval(self, source: str):
        result = self.engine.evaluate(source)
        if result.isError():
            raise RuntimeError(result.toString())
        return result


@pytest.fixture(scope="session")
def load_js(qapp):
    engines = []

    def load(filename: str) -> JsModule:
        engine = QJSEngine()
        engines.append(engine)
        module = engine.importModule(str(QML_DIR / filename))
        if module.isError():
            raise RuntimeError(module.toString())
        return JsModule(engine, module)

    return load


@pytest.fixture(scope="session")
def logic(load_js):
    return load_js("logic.mjs")
