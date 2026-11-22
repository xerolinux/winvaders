# WinVaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PySide6 + QML Space Invaders-style game with Microsoft-product parody aliens, saves, high scores, and an Arch PKGBUILD.

**Architecture:** Python owns process setup and persistence (`storage.py`, `shortcut.py`, `app.py` bridge). QML owns screens and the game loop; pure game rules live in an ES module (`logic.mjs`) and drawing in `sprites.mjs`, both importable from QML and testable from pytest through `QJSEngine.importModule`.

**Tech Stack:** Python >= 3.11, PySide6 6.x (QtQml, QtQuick, QtMultimedia), QML Canvas 2D, pytest, hatchling, makepkg.

**Spec:** `docs/superpowers/specs/2026-11-22-winvaders-design.md`

## Global Constraints

- All files under `/home/techxero/xwork/XeroInvaders`; nothing written elsewhere except by the built package.
- No git commits or pushes: the user commits. Tasks end with a verification, not a commit.
- No em-dashes anywhere (code, comments, docs, strings).
- Comments only for non-obvious WHY. No docstring padding.
- Canvas 2D only, no shader effects (must work with `QT_QUICK_BACKEND=software`).
- Logical playfield is 1280x720; window starts 1280x720, minimum 960x540.
- Aliens are original vector drawings evoking products; no bundled logo images.
- License GPL-3.0-or-later. Maintainer `DarkXero <info@techxero.com>`, url `https://xerolinux.xyz`.
- Persistence dir `$XDG_DATA_HOME/winvaders/` (default `~/.local/share/winvaders/`); every JSON file has `"version": 1`.
- Game loop Timer interval 16 ms; all per-tick values below are per 16 ms tick in logical pixels.

## Review Focus

1. Ultrawide or portrait-ish window/fullscreen: playfield stays 16:9, letterboxed, centered. Test in Task 5 (`test_stage_letterbox`).
2. Corrupt, partial, or wrong-version JSON, or an unwritable data dir: game starts, treats data as empty, never raises. Tests in Task 1.
3. Keys held while pausing, losing focus, or during the level banner: ship stops; no stuck movement. Test in Task 6 (`test_pause_clears_input`).
4. Name entry with empty, whitespace, 40-char, or emoji names: stored trimmed, max 12 chars, empty becomes `PLAYER`. Test in Task 1.
5. Save with missing fields or unknown version: Continue hidden, no crash. Test in Task 1 (`test_invalid_save_ignored`).

---

### Task 1: Project scaffold and storage

**Files:**
- Create: `pyproject.toml`, `LICENSE` (copy GPL-3.0 text from `/home/techxero/xwork/xen-installer/LICENSE`), `README.md` (short: what, run, build), `.gitignore`
- Create: `src/winvaders/__init__.py` (`__version__ = "1.0.0"`), `src/winvaders/storage.py`
- Test: `tests/test_storage.py`

**Interfaces:**
- Produces (`storage.py`):
  - `data_dir() -> Path` (honors `XDG_DATA_HOME`)
  - `class Storage(base_dir: Path | None = None)`
  - `Storage.load_save() -> dict | None` (None if absent, corrupt, version != 1, or missing any of `level, score, lives, next_life, seed`)
  - `Storage.write_save(data: dict) -> None`, `Storage.clear_save() -> None`, `Storage.has_save() -> bool`
  - `Storage.load_scores() -> list[dict]` entries `{name, score, level, date}` (date ISO string)
  - `Storage.qualifies(score: int) -> bool`
  - `Storage.add_score(name: str, score: int, level: int, date: str | None = None) -> int` (0-based rank, or -1 if not kept)
  - `Storage.load_settings() -> dict`, defaults `{"sound": True, "fullscreen": False, "last_name": ""}`
  - `Storage.save_settings(settings: dict) -> None`
  - `MAX_SCORES = 10`, `MAX_NAME = 12`

`pyproject.toml`: hatchling build, `name = "winvaders"`, `requires-python = ">=3.11"`, `dependencies = ["PySide6>=6.6"]`, `[project.scripts] winvaders = "winvaders.app:main"`, wheel includes `src/winvaders` with `qml/` and `sounds/` data, pytest `pythonpath = ["src"]`, `testpaths = ["tests"]`.

- [ ] **Step 1: Write failing tests** in `tests/test_storage.py` (each uses `Storage(tmp_path)`):
  - `test_data_dir_respects_xdg`: monkeypatch `XDG_DATA_HOME=tmp`, `data_dir() == tmp/"winvaders"`; unset gives `~/.local/share/winvaders`.
  - `test_save_roundtrip`: write `{"level":3,"score":1200,"lives":2,"next_life":10000,"seed":42}`, `load_save()` returns same keys, `has_save()` True; `clear_save()` then `load_save() is None`.
  - `test_invalid_save_ignored`: file `{"version":1,"level":3}` gives None; `{"version":99,...full}` gives None; `"{not json"` gives None; `has_save()` False for all.
  - `test_scores_sorted_and_capped`: add 12 scores, `len(load_scores()) == 10`, sorted desc, lowest two dropped.
  - `test_score_ties_keep_earlier_first`: add `("A",500,..,"2026-01-01")` then `("B",500,..,"2026-01-02")`; order A, B; returned rank of B is 1.
  - `test_qualifies`: empty table: `qualifies(0) is False`, `qualifies(10) is True`; full table min 100: `qualifies(100) is False`, `qualifies(101) is True`; `add_score` for non-qualifying returns -1.
  - `test_name_sanitized`: `"  bob  "` -> `"bob"`; 40 chars -> first 12; `"   "` -> `"PLAYER"`; `"🚀🚀"` kept.
  - `test_corrupt_scores_and_settings_recover`: garbage files give `[]` and default settings.
  - `test_unwritable_dir_does_not_raise`: base dir chmod 0o500; `write_save`, `add_score`, `save_settings` do not raise (skip if running as root).
  - `test_atomic_write_leaves_no_tmp`: after writes, no `*.tmp` files in dir.
- [ ] **Step 2: Run** `pytest tests/test_storage.py -v`. Expected: FAIL, `ModuleNotFoundError: winvaders.storage`.
- [ ] **Step 3: Implement `storage.py`.** Files `save.json`, `scores.json` (`{"version":1,"scores":[...]}`), `settings.json`. Atomic write: `tempfile.NamedTemporaryFile(dir=..., suffix=".tmp", delete=False)` then `os.replace`; create dir lazily with `mkdir(parents=True, exist_ok=True)`. Catch `OSError`/`ValueError` on read and write, log with `logging.getLogger("winvaders")`. Sort key `(-score, date)`.
- [ ] **Step 4: Run** `pytest tests/test_storage.py -v`. Expected: all PASS.

### Task 2: Game rules module

**Files:**
- Create: `src/winvaders/qml/logic.mjs`
- Test: `tests/conftest.py` (fixture `js` loading a module via `QJSEngine.importModule`, raising on `isError()`), `tests/test_logic.py`

**Interfaces:**
- Produces (`logic.mjs`, all `export`):
  - `ROSTER`: object keyed by type id -> `{name, tier, hp, points}`. Exact ids and values:
    - tier 1, hp 1, 10 pts: `word, excel, powerpoint, onenote, notepad, paint`
    - tier 2, hp 1, 20 pts: `outlook, teams, skype, onedrive, access, publisher`
    - tier 3, hp 2, 30 pts: `edge, ie, bing, cortana, defender`
    - tier 4, hp 2, 50 pts: `windows, xbox, azure, visualstudio, copilot`
  - `BOSSES`: `["clippy", "bsod", "winupdate"]`
  - `mulberry32(seed: number) -> () => number` in [0,1)
  - `tierUnlockLevel(tier) -> number` = `1 + 3 * (tier - 1)`
  - `unlockedTiers(level) -> number[]`
  - `isBossLevel(level) -> bool` (`level % 3 === 0`, user change)
  - `difficulty(level) -> {rows, cols, marchSpeed, stepDown, fireChance, enemyBulletSpeed, startY}`, with `n = level - 1`:
    - `rows = min(6, 4 + floor(n/3))`, `cols = min(10, 7 + floor(n/2))`
    - `marchSpeed = min(3.0, 0.6 + 0.18n)`, `stepDown = min(28, 14 + 1.5n)`
    - `fireChance = min(0.05, 0.008 + 0.004n)` (per tick, whole formation)
    - `enemyBulletSpeed = min(7, 3 + 0.3n)`, `startY = min(160, 90 + 6n)`
  - `generateWave(level, seed) -> {aliens: [{type, row, col, hp, maxHp, points}], boss: null | {type, hp, maxHp, points}}`
  - `bossStats(level) -> {k, type, hp, points, attackEvery, bulletSpeed, speed, attacks}` per spec boss section
  - `marchMultiplier(alive, total) -> number`: `1 + 1.5 * (1 - alive/total)`
  - `levelClearBonus(level, lives) -> lives * 100 * level`
  - `EXTRA_LIFE_EVERY = 10000`; `awardLives(score, nextLife) -> {gained, nextLife}`
  - `rectsOverlap(a, b) -> bool` for `{x,y,w,h}`
  - `POWERUPS = ["sudo", "pacman", "firewall"]`, `POWERUP_DROP = 0.04`, `POWERUP_TICKS = 500` (8 s at 16 ms)

`generateWave`: one type per row. For each row pick a tier from `unlockedTiers(level)` with weight equal to tier number, then a random type of that tier; rows sorted so higher tiers sit on top (row 0). Non-boss levels use `difficulty.rows` rows; boss levels use 2 escort rows of tier-1/2 types plus `boss` = `BOSSES[floor(rng()*3)]` with `bossStats`. Use only the seeded rng.

- [ ] **Step 1: Write failing tests** in `tests/test_logic.py` (call exports through the fixture; convert with `.toVariant()`):
  - `test_roster_values`: 22 types; `ROSTER.word == {name:"Word",tier:1,hp:1,points:10}`; `ROSTER.windows.hp == 2`.
  - `test_rng_deterministic`: two `mulberry32(7)` produce equal first 5 values, all in [0,1).
  - `test_unlock_schedule`: level 1 -> [1]; 4 -> [1,2]; 7 -> [1,2,3]; 10 -> [1,2,3,4].
  - `test_difficulty_level1_and_caps`: level 1 gives `rows 4, cols 7, marchSpeed 0.6, stepDown 14, fireChance 0.008, enemyBulletSpeed 3, startY 90`; level 100 gives exactly the caps.
  - `test_difficulty_monotonic`: each field non-decreasing for levels 1..60.
  - `test_wave_deterministic_and_shape`: same (level, seed) equal; level 1 has 28 aliens, all tier 1, `boss === null`.
  - `test_wave_uses_only_unlocked_tiers`: levels 1..30 x seeds 1..20, every alien tier in `unlockedTiers(level)`.
  - `test_wave_rows_sorted_by_tier`: row r tier >= row r+1 tier.
  - `test_wave_randomness`: level 12, seeds 1..50 produce at least 5 distinct row-type tuples.
  - `test_boss_levels`: level 5 and 10 have a boss in `BOSSES`, 2 escort rows; `bossStats(10) == {hp:40, points:1000}`; level 6 boss null.
  - `test_scoring_helpers`: `levelClearBonus(3,2) == 600`; `awardLives(25000, 10000) == {gained:2, nextLife:30000}`; `awardLives(9999,10000).gained == 0`; `marchMultiplier(28,28) == 1`, `marchMultiplier(0,28) == 2.5`.
  - `test_rects_overlap`: touching edges false, 1 px overlap true.
- [ ] **Step 2: Run** `pytest tests/test_logic.py -v`. Expected: FAIL, module load error.
- [ ] **Step 3: Implement `logic.mjs`** to the interface above.
- [ ] **Step 4: Run** `pytest tests/test_logic.py -v`. Expected: all PASS.

### Task 3: Sprites and sounds

**Files:**
- Create: `src/winvaders/qml/sprites.mjs`, `tools/gen_sounds.py`, `src/winvaders/sounds/*.wav` (generated)
- Test: `tests/test_sprites.py`, `tests/test_sounds.py`

**Interfaces:**
- Consumes: `ROSTER`, `BOSSES`, `POWERUPS` from `logic.mjs`.
- Produces (`sprites.mjs`):
  - `SPRITE_TYPES: string[]` (every ROSTER id, every BOSSES id, every POWERUPS id)
  - `drawAlien(ctx, type, x, y, w, h, damage, menace)`: `damage` in [0,1] adds cracks, `menace` 0..5 overlay as in xen's `drawMenace` and red tint
  - `drawBoss(ctx, type, x, y, w, h, hpFrac, tick)`
  - `drawPlayer(ctx, x, y, w, h, shielded)` (Tux-flavored ship)
  - `drawPowerup(ctx, type, x, y, size)`
  - `drawBunkerCell(ctx, x, y, size, hp)`
  - `drawEnemyBullet(ctx, sourceType, x, y)` (envelope for outlook, bubble for teams/skype, generic bolt otherwise)
- Produces (`gen_sounds.py`): `generate(out_dir: Path) -> list[Path]` writing `shoot, hit, explode, playerhit, levelup, powerup, boss` `.wav`, 22050 Hz mono 16-bit, each <= 1.0 s; `python tools/gen_sounds.py` writes to `src/winvaders/sounds/`.

Sprite look: base size 40x30 aliens, bosses 200x120. Each type a brand-evoking color plus glyph (Word blue page "W", Excel green grid "X", PowerPoint orange "P" + pie, OneNote purple "N", Notepad lined page, Paint palette, Outlook blue envelope "O", Teams purple "T" + people, Skype cyan "S" cloud, OneDrive blue cloud, Access maroon "A", Publisher teal "P", Edge swirl wave, IE blue "e" with ring, Bing teal "b", Cortana ring, Defender shield, Windows four panes, Xbox green sphere with X, Azure blue "A" triangle, Visual Studio purple infinity, Copilot gradient ribbon; Clippy paperclip with eyes, BSOD blue screen ":(", Windows Update progress panel with percent).

- [ ] **Step 1: Write failing tests:**
  - `test_sprites.py::test_every_type_has_sprite`: `SPRITE_TYPES` set equals union of ROSTER keys, BOSSES, POWERUPS.
  - `test_sprites.py::test_draw_functions_do_not_throw`: with a JS stub ctx (an object whose methods are no-ops via a `Proxy`, defined in the test JS), call every draw function for every type, damage 0/0.5/1, menace 0..5, no exception.
  - `test_sounds.py::test_generate_valid_wavs`: `generate(tmp_path)` returns 7 paths; each opens with `wave`, framerate 22050, 1 channel, sampwidth 2, `0 < frames <= 22050`.
- [ ] **Step 2: Run** `pytest tests/test_sprites.py tests/test_sounds.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `sprites.mjs` and `gen_sounds.py` (stdlib `wave`, `math`, `struct`; square/noise/sweep tones with linear fade-out), then run `python tools/gen_sounds.py`.
- [ ] **Step 4: Run** the tests again. Expected: all PASS.

### Task 4: Desktop shortcut script

**Files:**
- Create: `data/winvaders-shortcut` (POSIX sh, executable), `data/winvaders-shortcut-autostart.desktop`, `src/winvaders/shortcut.py`
- Test: `tests/test_shortcut.py`

**Interfaces:**
- Produces:
  - `winvaders-shortcut [--force]`. Source `${WINVADERS_DESKTOP_FILE:-/usr/share/applications/winvaders.desktop}`; marker `${XDG_DATA_HOME:-$HOME/.local/share}/winvaders/shortcut-done`; desktop dir from `xdg-user-dir DESKTOP` if available and non-empty, else `$HOME/Desktop`. Without `--force`: exit 0 doing nothing if marker exists. Exit 0 doing nothing if source missing. Otherwise `mkdir -p` desktop dir, `install -m755` source to `<desktop>/winvaders.desktop`, create marker. Always exit 0 (autostart must never error).
  - Autostart file: `Type=Application`, `Name=WinVaders Desktop Shortcut`, `Exec=/usr/lib/winvaders/winvaders-shortcut`, `NoDisplay=true`, `Terminal=false`.
  - `shortcut.py`: `SCRIPT = Path("/usr/lib/winvaders/winvaders-shortcut")`; `desktop_dir() -> Path` (same rule as the script); `has_shortcut() -> bool`; `install_shortcut(script: Path = SCRIPT) -> bool` runs `[script, "--force"]` with `timeout=10`, returns `has_shortcut()` afterwards, False (logged) if the script is missing.

- [ ] **Step 1: Write failing tests** (run the script with `env={"HOME": tmp, "PATH": <dir without xdg-user-dir>, "WINVADERS_DESKTOP_FILE": tmp_src}`):
  - `test_first_run_creates_icon_and_marker`: icon exists, mode `0o755`, content equals source; marker exists.
  - `test_second_run_respects_marker`: delete icon, run again; icon still absent.
  - `test_force_recreates`: after the above, `--force` recreates it.
  - `test_missing_source_is_noop`: exit 0, no icon, no marker.
  - `test_uses_xdg_user_dir`: fake `xdg-user-dir` on PATH printing `tmp/Bureau`; icon lands there.
  - `test_python_wrapper`: `install_shortcut(script=<repo data script>)` with monkeypatched env returns True; missing script returns False.
- [ ] **Step 2: Run** `pytest tests/test_shortcut.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** the script, autostart file, and `shortcut.py`.
- [ ] **Step 4: Run** `pytest tests/test_shortcut.py -v`, and `sh -n data/winvaders-shortcut` (plus `shellcheck` if installed). Expected: PASS, no warnings.

### Task 5: App shell, bridge, and menu screens

**Files:**
- Create: `src/winvaders/app.py`, `src/winvaders/__main__.py`, `src/winvaders/qml/Main.qml`, `Menu.qml`, `HighScores.qml`, `NameEntry.qml`, `Theme.qml` (singleton-free: a plain `QtObject` file instantiated in Main as `theme`)
- Test: `tests/test_app.py`

**Interfaces:**
- Consumes: `Storage` (Task 1), `install_shortcut`, `has_shortcut` (Task 4).
- Produces:
  - `app.StorageBridge(QObject)` slots: `hasSave() -> bool`, `loadSave() -> QVariantMap` (empty map if none), `writeSave(QVariantMap)`, `clearSave()`, `scores() -> QVariantList`, `qualifies(int) -> bool`, `addScore(str, int, int) -> int`, `settings() -> QVariantMap`, `setSetting(str, QVariant)`, `addDesktopShortcut() -> bool`, `hasDesktopShortcut() -> bool`
  - `app.create_engine(app: QGuiApplication) -> QQmlApplicationEngine` (sets context property `Storage`, loads `qml/Main.qml`, collects `engine.warnings` into `engine.qml_warnings: list[str]`)
  - `app.main() -> int`: `QGuiApplication`, `setApplicationName("WinVaders")`, `setOrganizationName("XeroLinux")`, `setDesktopFileName("winvaders")`, exit 1 if no root objects
  - `Main.qml` root `ApplicationWindow` `objectName: "window"`, width 1280, height 720, `minimumWidth 960`, `minimumHeight 540`, title "WinVaders", black background; child `Item` `objectName: "stage"` 1280x720 with `scale: Math.min(width/1280, height/720)` and centered; property `screen: "menu" | "game" | "scores" | "name"`; `toggleFullscreen()` switching `visibility` between `Window.FullScreen` and `Window.Windowed` and persisting `fullscreen` setting; `F11` and `F` shortcuts. Starts fullscreen if setting says so. Game slot is a `Loader` for `Game.qml` (Task 6), shown when `screen === "game"`.
  - `Menu.qml`: items New Game, Continue (visible when `Storage.hasSave()`), High Scores, Sound: On/Off, Fullscreen, Add Desktop Shortcut (visible when not `hasDesktopShortcut()`), Quit. Keyboard Up/Down/Enter and mouse. Animated title "WINVADERS" with a few drifting aliens via `sprites.mjs`.
  - `HighScores.qml`: top 10 table rank/name/score/level/date, Esc or Enter back; highlights `highlightRank` property.
  - `NameEntry.qml`: `TextInput` max 12, prefilled with `last_name`, Enter submits -> `Storage.addScore`, stores `last_name`, then shows HighScores with that rank highlighted.

- [ ] **Step 1: Write failing tests** in `tests/test_app.py` (module-level `os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")`, single `QGuiApplication` fixture, `XDG_DATA_HOME` -> tmp):
  - `test_main_qml_loads_without_warnings`: `create_engine` has 1 root object, `engine.qml_warnings == []`.
  - `test_window_defaults`: root width 1280, height 720, minimumWidth 960, title "WinVaders".
  - `test_stage_letterbox`: set window 2560x1080, process events; `stage.scale == 1.5`; at 960x540 `scale == 0.75`.
  - `test_bridge_roundtrip`: `addScore("bob", 500, 3) == 0`, `scores()[0]["name"] == "bob"`, `setSetting("sound", False)` reflected in `settings()`.
- [ ] **Step 2: Run** `pytest tests/test_app.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** app.py and the QML files (Game Loader may point to a placeholder until Task 6 lands; Task 6 replaces it).
- [ ] **Step 4: Run** `pytest -v`. Expected: all PASS. Then `python -m winvaders` from `src/` (via `PYTHONPATH=src`) and check the menu by eye under Wayland: window 1280x720, F11 fullscreen letterboxed.

### Task 6: Game screen

**Files:**
- Create: `src/winvaders/qml/Game.qml`
- Modify: `src/winvaders/qml/Main.qml` (wire Game signals)
- Test: `tests/test_game.py`

**Interfaces:**
- Consumes: everything in `logic.mjs` and `sprites.mjs`; `Storage` bridge.
- Produces (`Game.qml`, root `objectName: "game"`, 1280x720):
  - properties `score, level, lives, nextLife, seed, paused, gameOver, transitioning, moveLeft, moveRight, soundOn`
  - functions `startNew()`, `resume(save: object)`, `tick()`, `pause()`, `unpause()`, `saveAndQuit()`
  - signals `quitToMenu()`, `finished(int score, int level)`
  - Main: on `finished`, if `Storage.qualifies(score)` go to `name`, else `scores`; on `quitToMenu`, `menu`.

Behavior (values per Global Constraints):
- Player 56x24 at y 660, speed 7, max 3 bullets, bullet speed 12. `sudo`: 3-way spread; `pacman`: max 6 bullets + half cooldown; `firewall`: absorbs one hit. Base fire cooldown 12 ticks.
- Aliens 40x30, spacing 64x44, centered horizontally, start at `difficulty.startY`. March speed `difficulty.marchSpeed * marchMultiplier(alive,total)`; at edge (margin 20) step down `stepDown` and reverse. Enemy fire: each tick with `fireChance`, a random bottom-most alien of a random column fires; bullet speed `enemyBulletSpeed`.
- Bunkers: 4 at y 560, each 6x4 cells of 12 px, cell hp 3, damaged by both sides, cells under the formation are erased when aliens overlap them. Rebuilt each level.
- Boss (boss levels): 200x120 at top, moves side to side, HP bar; attacks every 90 ticks: clippy 5-bullet spread, bsod 3 slow wide bullets (40x16), winupdate a row of 8 bullets with one gap. Boss level clears when boss and escorts are dead.
- Hit: alien hp -1, damage visual `1 - hp/maxHp`, on 0 add points, 4% drop chance of a random powerup falling at speed 2. Player hit: lose life, 90-tick invulnerability blink, clear enemy bullets. Formation bottom >= 640 or lives 0: game over.
- Score changes call `awardLives`. Level clear: add `levelClearBonus`, `level += 1`, `seed = floor(rng*2^31)`, 70-tick "LEVEL n" banner (boss levels say "BOSS: <name>"), then `Storage.writeSave({level, score, lives, next_life: nextLife, seed})` and spawn.
- New game: `seed = Date.now() % 2147483647`. `resume(save)` restores fields and spawns that level with that seed.
- Game over: `Storage.clearSave()`, 120-tick "GAME OVER" overlay, then emit `finished`.
- Input: Left/A, Right/D, Space fire, Esc/P pause toggle, M sound toggle (persist `sound`). Pause overlay: Resume, Save & Quit, Quit to Menu (quit without save keeps the last auto-save). `pause()` and window deactivation (`Qt.application.state !== Qt.ApplicationActive`) clear `moveLeft/moveRight` and pause.
- HUD at top 50 px: score, hi-score (top of table), level, lives as small ships, active powerup with remaining time bar.
- Background: colorful glyph rain as in xen (`01$#&@%+=-_<>/~^`), alpha 0.25.
- Sounds: `SoundEffect` per wav from `sounds/`, played only when `soundOn`; wrap creation with `Qt.createQmlObject` in try/catch so a missing QtMultimedia leaves the game silent.

- [ ] **Step 1: Write failing tests** in `tests/test_game.py` (same offscreen fixture; find object `"game"` after setting window `screen` to `"game"` and calling `startNew()` through `QMetaObject.invokeMethod`):
  - `test_game_ticks_without_errors`: call `tick` 3000 times with `moveRight` toggled every 100 ticks and a fire attempt every 10 ticks via a QML-invokable `fire()`; `engine.qml_warnings == []`; `score >= 0`.
  - `test_pause_clears_input`: set `moveLeft = True`, call `pause()`; `moveLeft is False`, `paused is True`; 10 ticks leave player x unchanged.
  - `test_level_clear_autosaves`: invoke a test hook `killAll()` (keeps tests honest without simulating aim), tick past the banner; `level == 2`, and `Storage.loadSave()["level"] == 2`.
  - `test_game_over_clears_save`: set `lives = 1`, invoke `hitPlayer()`, tick 200; `finished` emitted once, save gone.
  - `test_resume_restores`: `resume({level:7, score:5000, lives:2, next_life:10000, seed:9})`; properties match and alien types are only from unlocked tiers at level 7.
- [ ] **Step 2: Run** `pytest tests/test_game.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** Game.qml (expose `fire()`, `killAll()`, `hitPlayer()` as plain functions; they are the same code paths keys and collisions use).
- [ ] **Step 4: Run** `pytest -v`. Expected: all PASS.
- [ ] **Step 5: Play it** with `PYTHONPATH=src python -m winvaders`: clear level 1, die, enter a name, see it in High Scores, quit mid-run, Continue, reach a boss with `killAll` disabled by playing (or by temporarily resuming a level-5 save in settings dir), fullscreen toggle mid-game.

### Task 7: Packaging

**Files:**
- Create: `data/winvaders.desktop`, `data/winvaders.svg`, `packaging/PKGBUILD`
- Test: `tests/test_packaging.py`

**Interfaces:**
- Consumes: entry point from Task 1, `DESKTOP_FILE` path from Task 4.

`winvaders.desktop`: `Type=Application`, `Name=WinVaders`, `GenericName=Arcade Shooter`, `Comment=Defend Linux from invading Microsoft apps`, `Exec=winvaders`, `Icon=winvaders`, `Terminal=false`, `Categories=Game;ArcadeGame;`, `StartupWMClass=winvaders`.

`winvaders.svg`: original art, a Tux-style ship firing at a four-pane-window invader, 128x128 viewBox.

`PKGBUILD`: `pkgname=winvaders`, `pkgver=1.0.0`, `pkgrel=1`, `arch=('any')`, `url="https://xerolinux.xyz"`, `license=('GPL-3.0-or-later')`, `depends=(python pyside6 qt6-declarative qt6-multimedia qt6-wayland)`, `makedepends=(python-build python-installer python-hatchling python-wheel)`, `_repo_root="${startdir}/.."`. `build()` runs `python -m build --wheel --no-isolation --outdir "${srcdir}/dist"` in `_repo_root`. `package()` runs `python -m installer --destdir="$pkgdir" "${srcdir}"/dist/*.whl`, then `install -Dm644` the desktop file to `usr/share/applications/`, `install -Dm644` the svg to `usr/share/icons/hicolor/scalable/apps/`, `install -Dm755 data/winvaders-shortcut` to `usr/lib/winvaders/winvaders-shortcut`, `install -Dm644 data/winvaders-shortcut-autostart.desktop` to `etc/xdg/autostart/winvaders-shortcut.desktop`, `install -Dm644 LICENSE` to `usr/share/licenses/$pkgname/`. No `etc/skel` files.

- [ ] **Step 1: Write failing tests:** `test_desktop_file_valid` (parse with `configparser`, keys above exact; if `desktop-file-validate` exists, run it on both .desktop files with exit 0); `test_icon_is_svg` (parses with `xml.etree`, root tag ends with `svg`); `test_pkgbuild_fields` (text contains `pkgname=winvaders`, `arch=('any')`, `usr/lib/winvaders/winvaders-shortcut`, `etc/xdg/autostart/winvaders-shortcut.desktop`, and does not contain `etc/skel`).
- [ ] **Step 2: Run** `pytest tests/test_packaging.py -v`. Expected: FAIL.
- [ ] **Step 3: Create** the three files.
- [ ] **Step 4: Run** `pytest -v`. Expected: all PASS.
- [ ] **Step 5: Build** `cd packaging && makepkg -f --cleanbuild`, then `tar -tf winvaders-1.0.0-1-any.pkg.tar.zst | sort` and confirm `usr/bin/winvaders`, `usr/share/applications/winvaders.desktop`, `usr/share/icons/hicolor/scalable/apps/winvaders.svg`, `usr/lib/winvaders/winvaders-shortcut` (mode `-rwxr-xr-x` per `tar -tvf`), `etc/xdg/autostart/winvaders-shortcut.desktop`, `usr/lib/python3.*/site-packages/winvaders/qml/Main.qml`, `.../sounds/shoot.wav`. Do not install the package; hand the user the `sudo pacman -U` command. Add `packaging/src/`, `packaging/pkg/`, `*.pkg.tar.zst` to `.gitignore`.
