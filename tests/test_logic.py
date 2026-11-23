import math

import pytest

CAPS = {
    "rows": 6,
    "cols": 10,
    "marchSpeed": 3.0,
    "stepDown": 28,
    "fireChance": 0.05,
    "enemyBulletSpeed": 7,
    "startY": 160,
}


def tier_of(logic, type_id):
    return logic.get("ROSTER")[type_id]["tier"]


def test_roster_values(logic):
    roster = logic.get("ROSTER")
    assert roster["word"] == {"name": "Word", "tier": 1, "hp": 1, "points": 10, "unlock": 1}
    assert roster["windows"]["hp"] == 2
    tiers = {}
    for t in roster.values():
        tiers.setdefault(t["tier"], set()).add((t["hp"], t["points"]))
    assert tiers == {1: {(1, 10)}, 2: {(1, 20)}, 3: {(2, 30)}, 4: {(2, 50)}}
    assert logic.get("BOSSES") == [
        "clippy", "cortanaboss", "zune", "bsod", "ieboss", "bob",
        "redring", "teamsboss", "winupdate", "kinect", "uac", "copilotboss",
    ]


def test_rng_deterministic(logic):
    src = "(m => { const r1 = m.mulberry32(7), r2 = m.mulberry32(7); const out = []; for (let i = 0; i < 5; i++) out.push([r1(), r2()]); return out; })"
    fn = logic.engine.evaluate(src)
    pairs = fn.call([logic.module]).toVariant()
    for x, y in pairs:
        assert x == y
        assert 0 <= x < 1


def test_unlock_schedule(logic):
    assert logic.call("unlockedTiers", 1) == [1]
    assert logic.call("unlockedTiers", 3) == [1]
    assert logic.call("unlockedTiers", 4) == [1, 2]
    assert logic.call("unlockedTiers", 7) == [1, 2, 3]
    assert logic.call("unlockedTiers", 10) == [1, 2, 3, 4]


def test_difficulty_level1_and_caps(logic):
    d1 = logic.call("difficulty", 1)
    assert d1 == pytest.approx(
        {"rows": 4, "cols": 7, "marchSpeed": 0.6, "stepDown": 14, "fireChance": 0.008, "enemyBulletSpeed": 3, "startY": 90}
    )
    assert logic.call("difficulty", 100) == pytest.approx(CAPS)


def test_difficulty_monotonic(logic):
    prev = logic.call("difficulty", 1)
    for lvl in range(2, 61):
        cur = logic.call("difficulty", lvl)
        for k in CAPS:
            assert cur[k] >= prev[k], (lvl, k)
        prev = cur


def test_wave_deterministic_and_shape(logic):
    a = logic.call("generateWave", 1, 123)
    b = logic.call("generateWave", 1, 123)
    assert a == b
    assert len(a["aliens"]) == 28
    assert a["boss"] is None
    for al in a["aliens"]:
        assert tier_of(logic, al["type"]) == 1
        assert al["hp"] == al["maxHp"] == 1
        assert al["points"] == 10


def test_roster_has_40_with_tier_stats(logic):
    roster = logic.get("ROSTER")
    assert len(roster) == 40
    assert roster["calculator"]["tier"] == 1 and roster["hololens"]["tier"] == 4


def test_unlock_table(logic):
    roster = logic.get("ROSTER")
    assert len(logic.call("unlockedTypes", 1)) == 8
    assert len(logic.call("unlockedTypes", 45)) == 40
    for t, info in roster.items():
        assert info["unlock"] >= logic.call("tierUnlockLevel", info["tier"])
        assert info["unlock"] == 1 or (info["unlock"] - 1) % 3 == 0
    for lvl in range(4, 46, 3):
        assert len(logic.call("newTypes", lvl)) in (0, 2, 3)
    assert all(not logic.call("newTypes", lvl) for lvl in [1, *range(3, 46, 3)])


def test_new_types_always_appear(logic):
    for lvl in range(4, 46, 3):
        for seed in (1, 2, 3):
            wave = logic.call("generateWave", lvl, seed)
            present = {a["type"] for a in wave["aliens"]}
            assert set(wave["newTypes"]) <= present


def test_wave_uses_only_unlocked_types(logic):
    for lvl in (1, 5, 20, 50):
        allowed = set(logic.call("unlockedTypes", lvl))
        for seed in range(5):
            assert {a["type"] for a in logic.call("generateWave", lvl, seed)["aliens"]} <= allowed


def test_wave_rows_sorted_by_tier(logic):
    for seed in range(1, 30):
        wave = logic.call("generateWave", 14, seed)
        row_tier = {}
        for al in wave["aliens"]:
            row_tier[al["row"]] = tier_of(logic, al["type"])
        rows = sorted(row_tier)
        for r in rows[:-1]:
            assert row_tier[r] >= row_tier[r + 1]


def test_wave_randomness(logic):
    seen = set()
    for seed in range(1, 51):
        wave = logic.call("generateWave", 12, seed)
        by_row = {}
        for al in wave["aliens"]:
            by_row[al["row"]] = al["type"]
        seen.add(tuple(by_row[r] for r in sorted(by_row)))
    assert len(seen) >= 5


def test_boss_levels(logic):
    for lvl in (3, 6, 9, 30):
        wave = logic.call("generateWave", lvl, 3)
        assert wave["boss"]["type"] in logic.get("BOSSES")
        assert len({al["row"] for al in wave["aliens"]}) == 2
        for al in wave["aliens"]:
            assert tier_of(logic, al["type"]) in (1, 2)
    boss = logic.call("generateWave", 6, 3)["boss"]
    assert boss["hp"] == boss["maxHp"] == 40
    assert logic.call("generateWave", 5, 3)["boss"] is None
    assert logic.call("isBossLevel", 3) is True
    assert logic.call("isBossLevel", 5) is False


def test_boss_order_and_escalation(logic):
    bosses = logic.get("BOSSES")
    assert len(bosses) == 12 and len(set(bosses)) == 12
    assert not set(bosses) & set(logic.get("ROSTER"))
    for k, b in enumerate(bosses, 1):
        s = logic.call("bossStats", 3 * k)
        assert (s["type"], s["guest"], s["fusion"], s["attacks"]) == (b, None, False, [b])
    b1 = logic.call("bossStats", 3)
    assert (b1["hp"], b1["points"], b1["attackEvery"]) == (25, 500, 100)
    f = logic.call("bossStats", 39)
    assert f["fusion"] is True and f["type"] != f["guest"]
    assert f["attacks"] == [f["type"], f["guest"]]
    prev = b1
    for lvl in range(6, 100, 3):
        cur = logic.call("bossStats", lvl)
        assert cur["hp"] > prev["hp"]
        assert cur["attackEvery"] <= prev["attackEvery"]
        assert cur["bulletSpeed"] >= prev["bulletSpeed"]
        assert cur["speed"] >= prev["speed"]
        assert cur["descend"] >= prev["descend"]
        prev = cur
    assert logic.call("bossStats", 300)["attackEvery"] == 35
    assert logic.call("bossStats", 300)["bulletSpeed"] == 7
    assert logic.call("bossStats", 300)["speed"] == 5
    assert logic.call("bossStats", 300)["descend"] == pytest.approx(0.3)


def test_fusion_pairs_cover_all_without_repeat(logic):
    pairs = [tuple(logic.call("fusionPair", n)) for n in range(132)]
    assert len(set(pairs)) == 132
    assert all(a != b for a, b in pairs)
    assert tuple(logic.call("fusionPair", 132)) == pairs[0]
    assert pairs == [tuple(logic.call("fusionPair", n)) for n in range(132)]


def test_boss_short_names(logic):
    short = logic.get("BOSS_SHORT")
    assert set(short) == set(logic.get("BOSSES"))
    assert max(len(f"{a} x {b}") for a in short.values() for b in short.values()) <= 20


def test_scoring_helpers(logic):
    assert logic.call("levelClearBonus", 3, 2) == 600
    assert logic.call("awardLives", 25000, 10000) == {"gained": 2, "nextLife": 30000}
    assert logic.call("awardLives", 9999, 10000)["gained"] == 0
    assert logic.call("marchMultiplier", 28, 28) == 1
    assert logic.call("marchMultiplier", 0, 28) == 2.5
    assert logic.get("EXTRA_LIFE_EVERY") == 10000


def test_rects_overlap(logic):
    a = {"x": 0, "y": 0, "w": 10, "h": 10}
    assert logic.call("rectsOverlap", a, {"x": 10, "y": 0, "w": 5, "h": 5}) is False
    assert logic.call("rectsOverlap", a, {"x": 9, "y": 9, "w": 5, "h": 5}) is True


def test_powerup_table(logic):
    pups = logic.get("POWERUPS")
    assert set(pups) == {"sudo", "pacman", "firewall", "bomb", "laser", "homing", "freeze", "double", "nuke", "oneup"}
    assert logic.get("POWERUP_DROP") == 0.06
    assert logic.get("POWERUP_TICKS") == 1875
    picked = {logic.call("pickPowerup", i / 1000) for i in range(1000)}
    assert picked == set(pups)
    assert logic.call("pickPowerup", 0.999999) in pups


def test_windows_update_attacks_less_often(logic):
    assert logic.call("attackDelay", "winupdate", 40) == 100
    assert logic.call("attackDelay", "clippy", 40) == 40


def test_step_enemy_bullet_kinds(logic):
    fn = logic.engine.evaluate("""(m => {
        const h = {x: 0, y: 0, vx: 0, vy: 2, home: 3, age: 0};
        for (let i = 0; i < 5; i++) m.stepEnemyBullet(h, 500);
        const s = {x: 0, y: 0, vx: 0, vy: 0, stall: 2, fall: 6, age: 0};
        m.stepEnemyBullet(s, 0); const y1 = s.y; m.stepEnemyBullet(s, 0); m.stepEnemyBullet(s, 0);
        const w = {x: 100, x0: 100, y: 0, vx: 0, vy: 1, amp: 40, age: 0};
        for (let i = 0; i < 12; i++) m.stepEnemyBullet(w, 0);
        return [h.vx > 0, h.vx <= 0.15 * 3 + 1e-9, h.home, y1, s.vy, s.age, w.x, w.y, w.age];
    })""")
    homed, capped, home_left, stalled_y, fall, age, wx, wy, wage = fn.call([logic.module]).toVariant()
    assert homed and capped and home_left == 0 and stalled_y == 0 and fall == 6 and age == 3
    assert wage == 12 and wy == 12
    assert wx == pytest.approx(100 + 40 * math.sin(12 / 8))


def test_mute_ticks(logic):
    assert logic.get("MUTE_TICKS") == 90
