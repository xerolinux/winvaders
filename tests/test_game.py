import pytest
from PySide6.QtCore import Q_ARG, QMetaObject, QObject
from PySide6.QtQml import QJSValue

from winvaders.app import create_engine
from winvaders.storage import Storage


def prop(obj, name):
    value = obj.property(name)
    return value.toVariant() if isinstance(value, QJSValue) else value


def invoke(obj, method, *args):
    assert QMetaObject.invokeMethod(obj, method, *[Q_ARG("QVariant", a) for a in args])


@pytest.fixture
def ctx(qapp, tmp_path, monkeypatch):
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    engine = create_engine(qapp)
    window = engine.rootObjects()[0]
    window.setProperty("screen", "game")
    qapp.processEvents()
    game = window.findChild(QObject, "game")
    assert game is not None
    yield engine, window, game, Storage(tmp_path / "winvaders")
    window.close()
    engine.deleteLater()
    qapp.processEvents()


def test_game_ticks_without_errors(ctx):
    engine, _, game, _ = ctx
    game.setProperty("lives", 10000)
    invoke(game, "tick")
    start_x = prop(game, "playerX")
    for i in range(3000):
        if i % 100 == 0:
            right = (i // 100) % 2 == 0
            game.setProperty("moveRight", right)
            game.setProperty("moveLeft", not right)
        if i % 10 == 0:
            invoke(game, "fire")
        invoke(game, "tick")
    assert engine.qml_warnings == []
    assert prop(game, "playerX") != start_x
    assert prop(game, "score") >= 0


def test_pause_clears_input(ctx):
    _, _, game, _ = ctx
    for _ in range(80):
        invoke(game, "tick")
    game.setProperty("moveLeft", True)
    invoke(game, "pause")
    assert prop(game, "moveLeft") is False
    assert prop(game, "paused") is True
    x = prop(game, "playerX")
    for _ in range(10):
        invoke(game, "tick")
    assert prop(game, "playerX") == x


def test_level_clear_autosaves(ctx):
    engine, _, game, storage = ctx
    assert storage.load_save()["level"] == 1
    invoke(game, "killAll")
    invoke(game, "tick")
    for _ in range(80):
        invoke(game, "tick")
    assert prop(game, "level") == 2
    assert prop(game, "score") > 0
    assert storage.load_save()["level"] == 2
    assert engine.qml_warnings == []


def test_game_over_clears_save(ctx):
    _, window, game, storage = ctx
    for _ in range(80):
        invoke(game, "tick")
    game.setProperty("lives", 1)
    invoke(game, "hitPlayer")
    assert prop(game, "gameOver") is True
    for _ in range(200):
        invoke(game, "tick")
    assert storage.load_save() is None
    assert window.property("screen") == "scores"


def test_game_over_with_high_score_asks_name(ctx):
    _, window, game, _ = ctx
    for _ in range(80):
        invoke(game, "tick")
    invoke(game, "killAll")
    game.setProperty("lives", 1)
    invoke(game, "hitPlayer")
    for _ in range(200):
        invoke(game, "tick")
    assert window.property("screen") == "name"


def test_resume_restores(ctx, logic):
    _, _, game, _ = ctx
    invoke(game, "resume", {"level": 7, "score": 5000, "lives": 2, "next_life": 10000, "seed": 9})
    assert prop(game, "level") == 7
    assert prop(game, "score") == 5000
    assert prop(game, "lives") == 2
    assert prop(game, "seed") == 9
    roster = logic.get("ROSTER")
    aliens = prop(game, "aliens")
    assert aliens
    allowed = set(logic.call("unlockedTiers", 7))
    assert {roster[a["type"]]["tier"] for a in aliens} <= allowed


def test_boss_level_spawns_boss(ctx, logic):
    engine, _, game, _ = ctx
    invoke(game, "resume", {"level": 12, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    assert prop(game, "boss")["type"] in logic.get("BOSSES")
    for _ in range(600):
        invoke(game, "tick")
    assert engine.qml_warnings == []


def test_boss_kill_grants_shield(ctx):
    _, _, game, _ = ctx
    invoke(game, "resume", {"level": 3, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    for _ in range(80):
        invoke(game, "tick")
    assert prop(game, "shield") is False
    invoke(game, "killAll")
    invoke(game, "tick")
    assert prop(game, "level") == 4
    assert prop(game, "shield") is True


def test_boss_descends_and_wins_at_player_row(ctx):
    _, window, game, _ = ctx
    invoke(game, "resume", {"level": 3, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    for _ in range(80):
        invoke(game, "tick")
    y0 = prop(game, "boss")["y"]
    for _ in range(300):
        invoke(game, "tick")
    assert prop(game, "boss")["y"] > y0
    invoke(game, "dropBossTo", 600)
    invoke(game, "tick")
    assert prop(game, "gameOver") is True


def test_game_uses_python_sound_board():
    from pathlib import Path

    qml = (Path(__file__).resolve().parent.parent / "src/winvaders/qml/Game.qml").read_text()
    assert "SoundEffect" not in qml
    assert "Sound.play(" in qml


SAVE = {"score": 0, "lives": 3, "next_life": 10000, "seed": 4}


def start(game, level, **extra):
    invoke(game, "resume", dict(SAVE, level=level, **extra))
    for _ in range(70):
        invoke(game, "tick")
    assert prop(game, "transitioning") is False


@pytest.mark.parametrize("level", list(range(3, 37, 3)) + [39, 42, 75])
def test_every_boss_level_runs(ctx, level):
    engine, _, game, _ = ctx
    invoke(game, "resume", dict(SAVE, level=level))
    game.setProperty("lives", 10000)
    for i in range(900):
        if i % 60 == 0:
            right = (i // 60) % 2 == 0
            game.setProperty("moveRight", right)
            game.setProperty("moveLeft", not right)
        if i % 8 == 0:
            invoke(game, "fire")
        invoke(game, "tick")
    assert engine.qml_warnings == []


def test_unique_boss_banner(ctx):
    _, _, game, _ = ctx
    invoke(game, "resume", dict(SAVE, level=24))
    assert prop(game, "bannerText") == "BOSS: TEAMS"
    assert prop(game, "bannerSub") == "Level 24"


def test_fusion_resume_is_stable(ctx):
    _, _, game, _ = ctx
    invoke(game, "resume", dict(SAVE, level=39))
    a = (prop(game, "boss")["type"], prop(game, "boss")["guest"])
    invoke(game, "resume", dict(SAVE, level=39, seed=99))
    b = (prop(game, "boss")["type"], prop(game, "boss")["guest"])
    assert a == b and prop(game, "bannerSub") == "FUSION"
    assert " x " in prop(game, "bannerText")


def test_new_types_banner(ctx, logic):
    _, _, game, _ = ctx
    invoke(game, "resume", dict(SAVE, level=4))
    roster = logic.get("ROSTER")
    names = [roster[t]["name"] for t in logic.call("newTypes", 4)]
    assert prop(game, "bannerSub") == "NEW: " + ", ".join(names)
    invoke(game, "resume", dict(SAVE, level=5))
    assert prop(game, "bannerSub") == ""


def test_teams_mute_caps_and_blocks_fire(ctx):
    _, _, game, _ = ctx
    start(game, 24)
    invoke(game, "applyMute")
    invoke(game, "applyMute")
    assert prop(game, "muted") == 90
    invoke(game, "fire")
    assert prop(game, "bullets") == []
    for _ in range(90):
        game.setProperty("enemyBullets", [])
        invoke(game, "tick")
    assert prop(game, "muted") == 0
    invoke(game, "fire")
    assert len(prop(game, "bullets")) == 1


def test_teams_bubble_mutes_instead_of_hurting(ctx):
    _, _, game, _ = ctx
    start(game, 24)
    invoke(game, "bossAttack", "teamsboss")
    bubbles = [e for e in prop(game, "enemyBullets") if e.get("mute")]
    assert 2 <= len(bubbles) <= 3
    lives = prop(game, "lives")
    x = prop(game, "playerX")
    game.setProperty("enemyBullets", [dict(bubbles[0], x=x, x0=x, y=650)])
    invoke(game, "tick")
    assert prop(game, "muted") == 90
    assert prop(game, "lives") == lives
    assert prop(game, "enemyBullets") == []


def test_bob_puppies_vanish_with_bob(ctx):
    _, _, game, _ = ctx
    start(game, 18)
    for _ in range(3):
        invoke(game, "bossAttack", "bob")
    assert len(prop(game, "minions")) == 4
    invoke(game, "killAll")
    assert prop(game, "minions") == []
    invoke(game, "tick")
    assert prop(game, "level") == 19


def test_uac_wall_blocks_player_bullet(ctx):
    _, _, game, _ = ctx
    start(game, 33)
    invoke(game, "bossAttack", "uac")
    walls = prop(game, "walls")
    assert 1 <= len(walls) <= 2
    wall = dict(walls[0], y=500)
    game.setProperty("walls", [wall])
    game.setProperty("bunkers", [])
    game.setProperty("playerX", wall["x"] + wall["w"] / 2 - 28)
    invoke(game, "fire")
    for _ in range(14):
        invoke(game, "tick")
    assert prop(game, "walls")[0]["hp"] == 2
    assert prop(game, "bullets") == []


def test_kinect_beam_telegraphs_then_fires(ctx):
    _, _, game, _ = ctx
    start(game, 30)
    invoke(game, "bossAttack", "kinect")
    beams = prop(game, "beams")
    assert len(beams) == 1 and beams[0]["tele"] == 50 and beams[0]["w"] == 24
    lives = prop(game, "lives")
    for _ in range(50):
        game.setProperty("enemyBullets", [])
        invoke(game, "tick")
    assert prop(game, "lives") == lives
    for _ in range(3):
        invoke(game, "tick")
    assert prop(game, "lives") == lives - 1


def test_music_follows_levels_and_pause(ctx):
    engine, window, game, _ = ctx
    music = engine.music
    invoke(game, "resume", {"level": 2, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    assert music.current == "level"
    invoke(game, "resume", {"level": 3, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    assert music.current == "clippy"
    invoke(game, "resume", {"level": 39, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    assert "+" in music.current
    invoke(game, "pause")
    assert music.paused
    invoke(game, "unpause")
    assert not music.paused
