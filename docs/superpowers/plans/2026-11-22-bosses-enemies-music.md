# WinVaders v1.1 (Bosses, Enemies, Music) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 12 unique bosses plus endless fusion bosses, a 40-type enemy roster unlocked over time, and quiet chiptune music with its own toggle.

**Architecture:** Pure game rules stay in `logic.mjs` (roster, unlocks, boss/fusion selection, bullet motion) and are tested through `QJSEngine`. Art stays in `sprites.mjs`. `Game.qml` wires attacks, banners and music cues. Music is note data in a new `music.py`, rendered to PCM stems in a background thread and looped through one `QAudioSink`, exposed to QML as `Music`.

**Tech Stack:** PySide6 6.12, QML Canvas 2D, ES modules, QtMultimedia `QAudioSink`, pytest.

**Spec:** `docs/superpowers/specs/2026-11-22-bosses-enemies-music-design.md` (v1 spec: `docs/superpowers/specs/2026-11-22-winvaders-design.md`)

## Global Constraints

- No `shadowBlur` anywhere; radial-gradient halos only. Every level, boss and fusion included, runs at 62.5 ticks/s.
- No new dependencies (no numpy). Audio only via `QAudioSink`, never QML `SoundEffect`.
- QJS has no object spread: use `Object.assign`.
- Saves keep `version: 1` and the same fields; boss and fusion derive from `level` (and `seed` for waves) only.
- Settings gain `music` (default `true`); files without it load the default.
- Original vector parody art only; no Microsoft logo files.
- No em-dashes in any file. No comments unless the why is non-obvious. Remove dead code in the same pass (old "borrowed attacks" rule, "Mk k" label, old `attacks` param of `drawBoss`).
- Music grid: 128 BPM, A minor, 16 bars of 4/4 = exactly 30 s = 661500 samples at 22050 Hz mono Int16.
- Run all tests with `python -m pytest -q` from the repo root.

## Review Focus

1. Resuming a save at a boss or fusion level must rebuild the same boss: test in Task 1 (`fusionPair` stable) and Task 5 (resume level 39 twice).
2. Teams mute must never exceed 90 ticks or stack: test in Task 5.
3. Music must not stall the game loop while stems render: Task 6 renders in a thread; Task 8 measures ticks/s during startup render.
4. Toggling music off mid-track, then on, must resume the right track for the current screen: test in Task 7.
5. Boss levels 3-36 and a few fusions each tick 600 times without QML warnings: test in Task 5.

---

### Task 1: Boss roster and fusion selection (logic)

**Files:**
- Modify: `src/winvaders/qml/logic.mjs`
- Test: `tests/test_logic.py`

**Interfaces:**
- Produces:
  - `BOSSES = ["clippy","cortanaboss","zune","bsod","ieboss","bob","redring","teamsboss","winupdate","kinect","uac","copilotboss"]` (order = levels 3..36)
  - `BOSS_NAMES` (full: "Clippy", "Cortana", "Zune", "Blue Screen of Death", "Internet Explorer", "Microsoft Bob", "Red Ring of Death", "Teams", "Windows Update", "Kinect", "UAC Prompt", "Copilot")
  - `BOSS_SHORT` (banner: CLIPPY, CORTANA, ZUNE, BSOD, IE, BOB, RROD, TEAMS, UPDATE, KINECT, UAC, COPILOT)
  - `fusionPair(n) -> [body, guest]`, n >= 0, from a fixed shuffle (mulberry32 with constant seed `0x5EED`) of all 132 ordered pairs, index `n % 132`
  - `bossStats(level)` returns `{k, type, guest, fusion, hp, points, attackEvery, bulletSpeed, speed, descend, attacks}`; `k <= 12`: `type = BOSSES[k-1]`, `guest = null`, `fusion = false`, `attacks = [type]`; `k > 12`: `[type, guest] = fusionPair(k - 13)`, `fusion = true`, `attacks = [type, guest]`. Numeric curves unchanged.

- [ ] **Step 1: Update tests.** Replace the `BOSSES` assertion in `test_roster_values` and rewrite `test_boss_order_and_escalation`:

```python
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
    # keep the existing monotonic loop and the level-300 caps checks


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
```

  Update `test_boss_levels` to drop the `bsod`-at-6 assumption (keep the escort-tier and hp checks).
- [ ] **Step 2: Run** `python -m pytest -q tests/test_logic.py`. Expected: FAIL (`BOSSES` length 3, `fusionPair` undefined).
- [ ] **Step 3: Implement** the produced interface in `logic.mjs`; delete the `k >= 4` / `k >= 7` borrowed-attacks code.
- [ ] **Step 4: Run** `python -m pytest -q tests/test_logic.py`. Expected: PASS. Sprite and game tests may fail until Tasks 4-5; that is expected and noted in the ledger.

### Task 2: 40-type roster with unlock table (logic)

**Files:**
- Modify: `src/winvaders/qml/logic.mjs`
- Test: `tests/test_logic.py`

**Interfaces:**
- Produces:
  - `ROSTER[id] = {name, tier, hp, points, unlock}`. New ids: tier 1 `calculator, solitaire, minesweeper, stickynotes, snippingtool, wordpad`; tier 2 `sharepoint, visio, project, planner, msn`; tier 3 `mediaplayer, moviemaker, silverlight, groove`; tier 4 `sqlserver, dynamics, hololens`.
  - `unlockedTypes(level) -> string[]`, `newTypes(level) -> string[]` (ids whose `unlock === level`).
  - `generateWave(level, seed)` returns `{aliens, boss, newTypes}`; every id in `newTypes(level)` gets at least one row; remaining rows weighted `tier * (unlock > level - 6 ? 3 : 1)`. Boss waves unchanged (2 rows, tiers <= 2).
- Rules the unlock table must satisfy (exact table is the implementer's choice): 8 tier-1 types at level 1; every other unlock level in `{4, 7, 10, ..., 43}`, never a boss level; 2 or 3 types per unlock level; no type before `tierUnlockLevel(tier)`; `unlockedTypes(45).length === 40`.

- [ ] **Step 1: Write tests.**

```python
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
    assert all(not logic.call("newTypes", lvl) for lvl in range(3, 46, 3))


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
```

  Delete `assert len(roster) == 22` from `test_roster_values`; keep its tier stat checks. Replace the old `test_wave_uses_only_unlocked_tiers` with the test above.
- [ ] **Step 2: Run** `python -m pytest -q tests/test_logic.py`. Expected: FAIL (roster 22).
- [ ] **Step 3: Implement.** If a level gets more forced new types than rows, all still get a row (rows max 6, new types max 3).
- [ ] **Step 4: Run** `python -m pytest -q tests/test_logic.py`. Expected: PASS.

### Task 3: Enemy sprites for 18 new types

**Files:**
- Modify: `src/winvaders/qml/sprites.mjs` (`DRAW` map)
- Test: `tests/test_sprites.py` (existing tests cover it)

- [ ] **Step 1: Run** `python -m pytest -q tests/test_sprites.py::test_every_type_has_sprite`. Expected: FAIL (missing 18 ids and 9 boss ids; boss ids fixed in Task 4).
- [ ] **Step 2: Implement** 18 drawings in the existing style (`officeIcon`-like body, legs from `drawLegs`, recognisable product colour and glyph: calculator keypad, solitaire card, minesweeper mine, yellow sticky note, scissors, WordPad page, SharePoint teal "S", Visio blue "V", Project green "P", Planner, MSN butterfly, Media Player orange play button, Movie Maker film strip, Silverlight grey-blue "S", Groove disc, SQL Server cylinder, Dynamics triangle, HoloLens visor). Each also gets an enemy bullet look through `drawEnemyBullet` (default fine).
- [ ] **Step 3: Verify visually.** Render a grid of all 40 types at menace 0 and 4 offscreen (grabWindow, as in v1) and inspect the PNG. Fix anything unreadable.
- [ ] **Step 4: Run** `python -m pytest -q tests/test_sprites.py -k "not every_type"`. Expected: PASS.

### Task 4: Boss sprites for 9 new bosses, mini icons, fusion look

**Files:**
- Modify: `src/winvaders/qml/sprites.mjs` (`BOSS_DRAW`, `MINI_ICON`, new `BOSS_ACCENT`, `drawBoss`)
- Test: `tests/test_sprites.py`

**Interfaces:**
- Consumes: `BOSSES`, `bossStats` from Task 1.
- Produces: `drawBoss(ctx, type, x, y, w, h, hpFrac, tick, k, guest)`; `guest` null for unique bosses. Fusion: body drawing, guest `MINI_ICON` orbiting (two copies, opposite phase), aura tinted `BOSS_ACCENT[guest]`, small "FUSION" label where "Mk k" was. Horns keep the `k >= 7` rule. No "Mk" label.

- [ ] **Step 1: Update tests.** In `test_draw_functions_do_not_throw`, loop bosses over levels `(3, 18, 36, 39, 60, 300)` and call `drawBoss(..., stats["k"], stats["guest"])`; also call every `(body, guest)` pair once at frac 0.5. Add:

```python
def test_every_boss_has_mini_icon_and_accent(sprites, logic):
    m = sprites.module
    for key in ("MINI_ICON_TYPES", "BOSS_ACCENT"):
        assert set(sprites.get(key)) == set(logic.get("BOSSES")), key
```

  (`MINI_ICON_TYPES = Object.keys(MINI_ICON)` exported.) Mirror the same boss/fusion loop in `test_no_shadow_blur`.
- [ ] **Step 2: Run** `python -m pytest -q tests/test_sprites.py`. Expected: FAIL.
- [ ] **Step 3: Implement** 9 bosses at the quality bar of Clippy/BSOD/Windows Update (gradients, face or eye, idle animation from `tick`, rage look when `hpFrac < 0.3`): Cortana glowing ring with inner pulse; Zune brown player with wheel and earbuds cable; Internet Explorer big blue "e" with orbit swoosh and loading spinner; Microsoft Bob yellow smiley house with dog Rover peeking; Red Ring of Death console with spinning red quadrants; Teams purple tile with "T" and webcam eye; Kinect black bar with three lenses that track `tick`; UAC prompt window with shield icon and "Allow?" Yes/No buttons; Copilot rainbow swirl blob with eyes. Plus `MINI_ICON` for all 12 and `BOSS_ACCENT` colours.
- [ ] **Step 4: Verify visually.** Offscreen screenshot sheet: all 12 bosses at hp 1 and 0.2, plus 4 fusions. Inspect; fix clipping or mud.
- [ ] **Step 5: Run** `python -m pytest -q tests/test_sprites.py`. Expected: PASS.

### Task 5: Boss attacks, minions, mute, walls, banners (game)

**Files:**
- Modify: `src/winvaders/qml/logic.mjs` (`stepEnemyBullet`), `src/winvaders/qml/Game.qml`, `src/winvaders/qml/sprites.mjs` (bullet, puppy, wall, beam looks)
- Test: `tests/test_logic.py`, `tests/test_game.py`

**Interfaces:**
- Consumes: Tasks 1, 2, 4.
- Produces:
  - `stepEnemyBullet(e, playerCx)` mutates bullet by kind fields: `home` (ticks left steering `vx` toward `playerCx`, max turn 0.15 per tick), `stall` (ticks with `vy = 0`, then `vy = fall`), `wave` (`x = x0 + amp * sin(age / 8)`), always `age++`.
  - Game state: `minions` (Bob puppies), `walls` (UAC), `beams` (Kinect), `muted` (ticks), `shotLog` (last 8 player shot x for Copilot). All reset in `beginLevel`.
  - `muteTicks` constant 90 in `logic.mjs` as `MUTE_TICKS`.
- Attack rules (numbers may be tuned, fairness rules may not):
  - cortanaboss: 2-4 homing rings, `home` 90.
  - zune: 5 wave bullets, amp 40.
  - ieboss: 4-6 orbs with `stall` 40, then `fall = 1.8 * v`.
  - bob: spawn puppies up to 4 alive; 1 hp, 10 points, walk down 0.6/tick, fire like aliens; removed when Bob dies or at `dangerY` (no game over); never block level clear; no drops.
  - redring: 14 radial bullets with a 3-bullet gap aimed at a random angle.
  - teamsboss: 2-3 "muted" bubbles; touching player sets `muted = MUTE_TICKS` (no life lost, no stacking above 90); player bullets destroy bubbles; `fire()` returns while `muted > 0`; HUD shows "MUTED".
  - kinect: beam at player x, telegraphed 50 ticks (faint line), active 15 ticks, 24 px wide, hits like a bullet.
  - uac: 1-2 walls (90x24, hp 3) falling 0.8/tick; block player bullets until destroyed; vanish at `dangerY`; harmless to player.
  - copilotboss: bullets straight down at each `shotLog` x plus a 3-way spread.
  - Fusion: alternate `attacks[attackIndex % 2]` (existing rotation).
  - Banner: unique `"BOSS: " + BOSS_NAMES[type].toUpperCase()`, sub `"Level " + level`; fusion `BOSS_SHORT[type] + " x " + BOSS_SHORT[guest]`, sub `"FUSION"`; normal levels sub `"NEW: " + names.join(", ")` when `newTypes` non-empty.

- [ ] **Step 1: Write tests.**

```python
# test_logic.py
def test_step_enemy_bullet_kinds(logic):
    fn = logic.engine.evaluate("""(m => {
        const h = {x: 0, y: 0, vx: 0, vy: 2, home: 3, age: 0};
        for (let i = 0; i < 5; i++) m.stepEnemyBullet(h, 500);
        const s = {x: 0, y: 0, vx: 0, vy: 0, stall: 2, fall: 6, age: 0};
        m.stepEnemyBullet(s, 0); const y1 = s.y; m.stepEnemyBullet(s, 0); m.stepEnemyBullet(s, 0);
        return [h.vx > 0, h.home, y1, s.vy];
    })""")
    homed, home_left, stalled_y, fall = fn.call([logic.module]).toVariant()
    assert homed and home_left == 0 and stalled_y == 0 and fall == 6

# test_game.py
@pytest.mark.parametrize("level", list(range(3, 37, 3)) + [39, 42, 75])
def test_every_boss_level_runs(ctx, level):
    engine, _, game, _ = ctx
    game.setProperty("lives", 10000)
    invoke(game, "resume", {"level": level, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    for _ in range(900):
        invoke(game, "tick")
    assert engine.qml_warnings == []

def test_fusion_resume_is_stable(ctx):
    _, _, game, _ = ctx
    save = {"level": 39, "score": 0, "lives": 3, "next_life": 10000, "seed": 4}
    invoke(game, "resume", save); a = (prop(game, "boss")["type"], prop(game, "boss")["guest"])
    invoke(game, "resume", dict(save, seed=99)); b = (prop(game, "boss")["type"], prop(game, "boss")["guest"])
    assert a == b and prop(game, "bannerSub") == "FUSION"

def test_teams_mute_caps_and_blocks_fire(ctx):
    # resume level 24, skip banner, call applyMute() twice, assert muted == 90,
    # fire() adds no bullet while muted, after 90 ticks fire() works again

def test_bob_puppies_vanish_with_bob(ctx):
    # resume level 18, tick until minions non-empty (or call bossAttack("bob")),
    # killAll(); tick; assert minions == [] and level advanced to 19

def test_uac_wall_blocks_player_bullet(ctx):
    # resume level 33, bossAttack("uac"), dropWallsTo(player-ish y), fire, tick,
    # assert wall hp dropped and bullet consumed

def test_new_types_banner(ctx):
    # resume level 4 (a level with newTypes); assert bannerSub starts with "NEW: "
```

  Seams: add `applyMute()` and `dropWallsTo(y)` only if the test cannot reach the state through `bossAttack`/`tick`; otherwise drive it through real calls. Update `test_boss_level_spawns_boss` to check `type in BOSSES`.
- [ ] **Step 2: Run** `python -m pytest -q tests/test_logic.py tests/test_game.py`. Expected: FAIL.
- [ ] **Step 3: Implement** in `Game.qml` and `logic.mjs`, plus draw helpers for puppy, wall, beam, and per-boss bullet looks in `sprites.mjs` (no `shadowBlur`).
- [ ] **Step 4: Run** `python -m pytest -q`. Expected: all PASS.
- [ ] **Step 5: Perf check.** Real window (`QT_QUICK_BACKEND` unset), resume each boss level 3..36 and 39, 42; measure ticks/s over 5 s with `tickCount`. Expected: 62.5 +/- 1 on each. Record numbers in the ledger.

### Task 6: Music engine

**Files:**
- Create: `src/winvaders/music.py`
- Test: `tests/test_music.py`

**Interfaces:**
- Produces:
  - Constants `RATE = 22050`, `BPM = 128`, `BARS = 16`, `LOOP_SAMPLES = 661500`, `MENU_VOLUME = 0.12`, `GAME_VOLUME = 0.2`.
  - `SONGS: dict[str, Song]` with keys `menu`, `level`, and the 12 boss ids from `BOSSES`. `Song` holds `lead`, `bass`, `drums` patterns (compact note strings or lists; format is the implementer's choice) on a 16th-note grid in A minor.
  - `render_stems(name) -> dict[str, array.array]` (keys `lead`, `bass`, `drums`, Int16, each `LOOP_SAMPLES` long). Instruments: pulse lead (25% duty), triangle bass, noise drums (kick, snare, hat). Notes placed at `round(step * LOOP_SAMPLES / 256)` so the loop never drifts. Per-note waveforms cached.
  - `mix(stems: list[array.array]) -> bytes`, clamped to Int16.
  - `track_bytes(name) -> bytes`: `name` is a song key, or `"body+guest"` = body `lead` + guest `bass` + guest `drums`.
  - `LoopDevice(QIODevice)`: read-only, `readData` wraps to the start for a gapless loop.
  - `MusicPlayer(QObject)`: slots `play(name)` (no-op if already current), `pause()`, `resume()`, `stop()`, `setEnabled(bool)`, `isPlaying() -> bool`; Python attributes `current` (str) and `paused` (bool) read by tests. `play` while disabled stores the name and starts it on `setEnabled(True)`. Volume: `MENU_VOLUME` for `menu`, else `GAME_VOLUME`. Stems render in one `threading.Thread` at construction (order: menu, level, then bosses); `play` of an unrendered track waits for it and starts when ready via a queued signal; never blocks the caller.

- [ ] **Step 1: Write tests.**

```python
from winvaders import music

BOSSES = [...]  # read from logic.mjs via the `logic` fixture instead of hardcoding

def test_songs_cover_menu_level_and_bosses(logic):
    assert set(music.SONGS) == {"menu", "level", *logic.get("BOSSES")}

def test_stems_share_the_grid():
    for name in music.SONGS:
        stems = music.render_stems(name)
        assert set(stems) == {"lead", "bass", "drums"}
        assert {len(s) for s in stems.values()} == {music.LOOP_SAMPLES}

def test_fusion_mix_uses_body_lead_and_guest_rhythm():
    a, b = music.render_stems("clippy"), music.render_stems("teamsboss")
    expected = music.mix([a["lead"], b["bass"], b["drums"]])
    assert music.track_bytes("clippy+teamsboss") == expected
    assert len(expected) == music.LOOP_SAMPLES * 2

def test_loop_device_wraps():
    dev = music.LoopDevice(b"abcdef"); dev.open(QIODevice.ReadOnly)
    assert bytes(dev.read(4)) == b"abcd" and bytes(dev.read(4)) == b"efab"

def test_render_all_is_fast_enough():
    # render every song from a cold cache; assert total < 15 s, menu < 1.5 s

def test_player_state(qapp):
    p = music.MusicPlayer()
    p.setEnabled(False); p.play("menu"); assert p.current == "menu" and not p.isPlaying()
    p.setEnabled(True); wait_until(p.isPlaying, qapp)
    p.pause(); assert not p.isPlaying(); p.resume(); assert p.isPlaying()
    assert p.play("nope") is False
```

- [ ] **Step 2: Run** `python -m pytest -q tests/test_music.py`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `music.py` and compose 14 original loops (menu: slow arpeggio; level: driving bassline; bosses: each with its own lead motif and drum feel). Peak level after `mix` must not clip: add `assert max(abs(s)) < 32767` over `track_bytes` of every song and 5 fusions to the stems test.
- [ ] **Step 4: Run** `python -m pytest -q tests/test_music.py`. Expected: PASS.

### Task 7: Wire music, toggle, menu, HUD

**Files:**
- Modify: `src/winvaders/storage.py` (`DEFAULT_SETTINGS["music"] = True`), `src/winvaders/app.py` (`engine.music = MusicPlayer(parent=engine)`, context property `Music`), `qml/Main.qml`, `qml/Menu.qml`, `qml/Game.qml`
- Test: `tests/test_storage.py`, `tests/test_app.py`, `tests/test_game.py`

**Interfaces:**
- Consumes: `MusicPlayer` slots from Task 6; boss `type`/`guest` from Task 1.
- Behaviour:
  - `Main.qml`: `onSettingsChanged` also calls `Music.setEnabled(settings.music)`; menu, scores and name screens call `Music.play("menu")`; `Shortcut { sequences: ["N"]; enabled: screen !== "name" }` toggles `music`.
  - `Menu.qml`: `musicOn` property, entry `MUSIC: ON/OFF` right after `SOUND`, signal `toggleMusic()`.
  - `Game.qml`: `musicOn` property bound from Main; `beginLevel` plays `"level"`, or `boss.type` for unique bosses, or `boss.type + "+" + boss.guest` for fusions; `pause()` calls `Music.pause()`, `unpause()` calls `Music.resume()`; `endGame()` calls `Music.stop()`; HUD music icon next to the sound icon (dimmed when off).

- [ ] **Step 1: Write tests.**

```python
# test_storage.py
def test_settings_default_music(tmp_path):
    s = Storage(tmp_path)
    assert s.load_settings()["music"] is True
    (tmp_path / "settings.json").write_text('{"version": 1, "sound": false}')
    assert s.load_settings()["music"] is True

# test_app.py
def test_menu_has_music_toggle(engine, qapp):
    # menu entries include "MUSIC: ON"; toggling via N flips settings.music and the label

# test_game.py
def test_music_follows_levels_and_pause(ctx):
    engine, window, game, _ = ctx
    music = engine.music
    invoke(game, "resume", {"level": 2, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    assert music.current == "level"
    invoke(game, "resume", {"level": 3, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    assert music.current == "clippy"
    invoke(game, "resume", {"level": 39, "score": 0, "lives": 3, "next_life": 10000, "seed": 4})
    assert "+" in music.current
    invoke(game, "pause"); assert music.paused
    invoke(game, "unpause"); assert not music.paused

def test_music_toggle_resumes_current_screen_track(engine, qapp):
    # menu screen, toggle music off then on, assert current == "menu" and playing
```

- [ ] **Step 2: Run** `python -m pytest -q`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `python -m pytest -q`. Expected: all PASS, no QML warnings.

### Task 8: Version, packaging, live verification

**Files:**
- Modify: `pyproject.toml`, `src/winvaders/__init__.py`, `packaging/PKGBUILD` (version `1.1.0`, `pkgrel=1`), v1 spec (link to the v1.1 spec in its boss section)
- Test: `tests/test_packaging.py`

- [ ] **Step 1: Bump** versions to `1.1.0`. Run `python -m pytest -q tests/test_packaging.py`. Expected: PASS.
- [ ] **Step 2: Build** `cd packaging && makepkg -f --cleanbuild`. Expected: `winvaders-1.1.0-1-any.pkg.tar.zst`; `bsdtar -tf` lists `music.py`.
- [ ] **Step 3: Run the real game** (`PYTHONPATH=src python -m winvaders`) on Wayland. Check: menu music starts within ~1 s; ticks/s stays 62.5 during the startup render; `pactl list sink-inputs` shows the music stream not muted; N and M toggle independently.
- [ ] **Step 4: Ask the user to listen** to menu, level 1 and one boss, and confirm music sits under the effects. Adjust `MENU_VOLUME` / `GAME_VOLUME` from their answer.
- [ ] **Step 5: Run** `python -m pytest -q` once more. Expected: all PASS.
