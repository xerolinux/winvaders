import pytest

STUB_CTX = """
(function () {
    const target = { canvas: { width: 1280, height: 720 } };
    return new Proxy(target, {
        get(t, k) {
            if (k in t) return t[k];
            return function () { return { addColorStop() {} }; };
        },
        set(t, k, v) { t[k] = v; return true; }
    });
})()
"""


@pytest.fixture(scope="module")
def sprites(load_js):
    return load_js("sprites.mjs")


def test_every_type_has_sprite(sprites, logic):
    expected = set(logic.get("ROSTER")) | set(logic.get("BOSSES")) | set(logic.get("POWERUPS"))
    assert set(sprites.get("SPRITE_TYPES")) == expected


def test_every_roster_type_has_alien_drawing(sprites, logic):
    assert set(sprites.get("ALIEN_TYPES")) == set(logic.get("ROSTER"))


def test_draw_functions_do_not_throw(sprites, logic):
    ctx = sprites.eval(STUB_CTX)
    m = sprites.module

    def call(name, *args):
        fn = m.property(name)
        assert fn.isCallable(), name
        values = [ctx] + [sprites.engine.toScriptValue(a) for a in args]
        result = fn.call(values)
        assert not result.isError(), f"{name}{args}: {result.toString()}"

    for t in logic.get("ROSTER"):
        for damage in (0, 0.5, 1):
            for menace in range(6):
                call("drawAlien", t, 10, 20, 40, 30, damage, menace, menace % 2)
        call("drawEnemyBullet", t, 50, 50, 10, 14)
    for b in logic.get("BOSSES"):
        call("drawEnemyBullet", b, 50, 50, 40, 16)
        for lvl in (3, 18, 36, 39, 60, 300):
            stats = logic.call("bossStats", lvl)
            for frac in (1, 0.5, 0.2, 0):
                call("drawBoss", b, 100, 60, 220, 130, frac, 42, stats["k"], stats["guest"])
    bosses = logic.get("BOSSES")
    for body in bosses:
        for guest in bosses:
            if body != guest:
                call("drawBoss", body, 100, 60, 220, 130, 0.5, 42, 20, guest)
    for p in logic.get("POWERUPS"):
        call("drawPowerup", p, 10, 10, 24)
    for shielded in (False, True):
        call("drawPlayer", 600, 660, 56, 24, shielded)
    for hp in (1, 2, 3):
        call("drawBunkerCell", 0, 0, 12, hp)
        call("drawUacWall", 100, 300, 90, 24, hp)
    for frame in (0, 1):
        call("drawPuppy", 100, 300, 30, 24, frame)
    for tele, active in ((50, 15), (1, 15), (0, 15), (0, 1)):
        call("drawKinectBeam", 400, 24, 190, 720, tele, active)


def test_no_shadow_blur(sprites, logic):
    # Qt Canvas blurs every primitive drawn under shadowBlur; it dropped boss
    # and late levels to a few frames per second.
    ctx = sprites.eval(STUB_CTX.replace("set(t, k, v) { t[k] = v; return true; }",
                                        "set(t, k, v) { if (k === 'shadowBlur' && v > 0) throw new Error('shadowBlur'); t[k] = v; return true; }"))
    m = sprites.module

    def call(name, *args):
        fn = m.property(name)
        assert fn.isCallable(), name
        result = fn.call([ctx] + [sprites.engine.toScriptValue(a) for a in args])
        assert not result.isError(), f"{name}{args}: {result.toString()}"

    for t in logic.get("ROSTER"):
        call("drawAlien", t, 10, 20, 40, 30, 0, 5, 0)
    bosses = logic.get("BOSSES")
    for i, body in enumerate(bosses):
        for frac in (1, 0.2):
            call("drawBoss", body, 100, 60, 220, 130, frac, 42, i + 1, None)
        for guest in bosses:
            if body != guest:
                call("drawBoss", body, 100, 60, 220, 130, 0.5, 42, 20, guest)
        call("drawEnemyBullet", body, 50, 50, 34, 22)
    call("drawUacWall", 100, 300, 90, 24, 3)
    call("drawPuppy", 100, 300, 30, 24, 0)
    call("drawKinectBeam", 400, 24, 190, 720, 0, 15)
    call("drawKinectBeam", 400, 24, 190, 720, 30, 15)


def test_every_boss_has_mini_icon_and_accent(sprites, logic):
    for key in ("MINI_ICON_TYPES", "BOSS_ACCENT"):
        assert set(sprites.get(key)) == set(logic.get("BOSSES")), key
