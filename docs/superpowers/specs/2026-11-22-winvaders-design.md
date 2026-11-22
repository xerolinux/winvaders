# WinVaders - Design

## Intent

A just-for-fun Space Invaders-style arcade game shipped with XeroLinux. The invaders
are parody icons of Microsoft products (Office, Windows, and others). It is a
standalone Arch package, preinstalled on the live ISO with a desktop icon, removed
from installed systems by the ISO pipeline, and reinstallable with
`pacman -S winvaders`.

Inspired by `xen-installer/src/xen/gui/qml/components/SpaceInvadersGame.qml`
(QML Canvas + Timer loop, vector-drawn invaders, endless escalating levels,
"menace" overlay). This game grows that into a full game with saves, high scores,
lives, enemy fire, and random waves.

## Goals

- Plays well, looks colorful, starts in a 1280x720 window, toggles fullscreen.
- Aliens are drawn in code as recognizable parody icons of Microsoft products.
- Each level randomly picks its alien mix; difficulty rises every level, endlessly.
- Save/continue a run; persistent top-10 high score table with player names.
- Ships as an Arch package (PKGBUILD) with a menu entry and a live-session desktop icon.
- Wayland-native (Qt default platform, correct app id for icon/taskbar matching).

## Non-goals

- No online leaderboards, networking, or telemetry.
- No gamepad support in v1.
- No translations in v1 (strings in English; QML uses `qsTr` so they can come later).
- No mouse aiming; keyboard only.

## Anti-goals

- Copying real Microsoft logo artwork pixel-for-pixel or bundling their image files.
  Icons are original vector drawings that evoke the product (color + letter/shape).
- Adding a new heavy dependency to the live ISO. Only PySide6/Qt6, which the ISO
  already ships for xen-installer.
- Leaving files behind on installed systems after package removal.

## Constraints

- Arch Linux, `arch=('any')`, Python >= 3.11, PySide6 6.x, Qt 6 QML.
- Must run on the ISO where xen-installer uses `QT_QUICK_BACKEND=software`; no shader
  effects. Canvas 2D only (same as the xen game).
- License GPL-3.0-or-later (matches xen-installer).

## Approaches

1. **PySide6 + QML Canvas (picked).** Same stack and rendering approach as the xen
   game; zero extra ISO weight since PySide6 is already there; Wayland-native.
   Downside: ~100 MB PySide6 pull-in for users who reinstall on a system without it.
2. Python + pygame: lighter for installed systems, but a new ISO dependency, weaker
   Wayland polish, and nothing reused from xen.
3. Native C++/Qt6: fastest start, smallest deps, but compiled build and slower
   iteration; overkill for a fun game.

The user picked 1.

## Decided by the user

- Folder: everything lives in `/home/techxero/xwork/XeroInvaders`, nowhere else.
- Aliens: Microsoft products, random per level, harder each level.
- Saves and high scores.
- Starts 1280x720, can go fullscreen.
- Desktop icon on the user's desktop; Arch package via PKGBUILD; preinstalled on live
  ISO; installed systems get it via pacman.
- Stack: PySide6 + QML.

## Design (builder's calls marked "call")

### Layout

```
WinVaders/
  pyproject.toml                 hatchling, entry point winvaders = winvaders.app:main
  src/winvaders/
    __init__.py
    __main__.py                  python -m winvaders
    app.py                       QGuiApplication, engine, window, Storage bridge
    storage.py                   saves/scores/settings JSON (pure Python, tested)
    qml/
      Main.qml                   window, scaling, screen state machine
      Game.qml                   game loop, input, Canvas rendering
      Menu.qml, HighScores.qml, NameEntry.qml, Pause/GameOver overlays
      logic.mjs                  pure game rules: wave generation, difficulty,
                                 collisions, scoring (ES module, tested)
      sprites.js                 alien/player/boss drawing routines
    sounds/*.wav                 small synthesized effects
  tools/gen_sounds.py            regenerates sounds/*.wav (stdlib only)
  data/
    winvaders.desktop
    winvaders.svg             app icon (original art)
  packaging/PKGBUILD
  tests/                         pytest
```

### Window and scaling

- `ApplicationWindow` 1280x720 initial, resizable, minimum 960x540.
- Game renders into a fixed 1280x720 logical playfield, scaled uniformly to fit the
  window and letterboxed (black bars). Fullscreen shows the same game, bigger.
- `F11` or `F` toggles fullscreen; `Esc` pauses (and leaves fullscreen only from the
  pause menu "Quit to menu"). Fullscreen preference is remembered.
- `app.setDesktopFileName("winvaders")` so Wayland app_id matches the .desktop file.

### Screens

Main menu: New Game, Continue (only if a save exists), High Scores, Sound on/off,
Fullscreen toggle, Quit. Then Game, Pause overlay, Level banner, Game Over, Name entry
(when the score makes the top 10), High Scores table.

### Gameplay

- Player ship (Tux-flavored, call) bottom of screen, 3 lives, moves Left/Right or A/D,
  fires with Space. Max 3 player bullets on screen (2 at level 1 feels too stingy; call).
- Formation marches side to side and steps down at edges, like the xen game. It speeds
  up as aliens die (classic feel; call).
- Aliens shoot back; product-flavored projectiles (envelope from Outlook, chat bubble
  from Teams, etc. are cosmetic only; call).
- 4 destructible "firewall" bunkers, rebuilt each level (call).
- Game over when lives hit 0 or the formation reaches the player row.
- Extra life every 10,000 points (call).

### Alien roster (original parody art, drawn in `sprites.js`)

Tiered so that later levels unlock tougher types. HP = hits to kill.

| Tier | Aliens | HP | Points |
|------|--------|----|--------|
| 1 | Word, Excel, PowerPoint, OneNote, Notepad, Paint | 1 | 10 |
| 2 | Outlook, Teams, Skype, OneDrive, Access, Publisher | 1 | 20 |
| 3 | Edge, Internet Explorer, Bing, Cortana, Defender | 2 | 30 |
| 4 | Windows, Xbox, Azure, Visual Studio, Copilot | 2 | 50 |
| Boss | Clippy, BSOD, Windows Update (every 3rd level, escalating) | 25+ | 500k |

Each icon: brand-ish color tile or shape plus a letter/glyph (e.g. blue page with "W",
green grid with "X", four-pane window, blue screen with ":(" ). Damaged multi-HP
aliens show cracks. The xen "menace" overlay (angry eyes, fangs, glow, spikes) carries
over and rises with level.

### Levels and difficulty (in `logic.mjs`, seeded RNG so tests are deterministic)

- Each level draws a random set of types from the unlocked tiers: level 1 uses tier 1;
  each tier unlocks every 3 levels; later levels weight toward higher tiers.
- Rows grow from 4 to 6, columns from 7 to 10, capped.
- March speed, step-down, enemy fire rate, and enemy bullet speed all rise per level,
  each capped so it stays playable.
- Every 3rd level is a boss level (user request, 2026-11-22): one boss plus 2 escort
  rows. Bosses escalate: boss k (= level / 3) has HP `25 + 15(k-1)`, attacks every
  `max(35, 100 - 10(k-1))` ticks, bullet speed `min(7, 3 + 0.5(k-1))`, move speed
  `min(5, 1.5 + 0.4(k-1))`. Order: k=1 Clippy ("It looks like you're losing" spread
  shot), k=2 BSOD (wide slow beams), k=3 Windows Update (progress-bar wall with one
  gap). From k=4 bosses combine two attack patterns, from k=7 all three. HP bar shown.
  Bosses descend `min(0.3, 0.06 + 0.02(k-1))` px per tick; reaching the player row ends
  the game (user request).
- Level clear bonus: remaining lives x 100 x level (call).

### Power-ups (call: small, Linux-themed, dropped randomly by killed aliens ~4%)

- `sudo` - spread shot (8 s)
- `pacman -Syu` - rapid fire (8 s)
- Firewall - one-hit shield

### Persistence (`storage.py`, exposed to QML as a `Storage` QObject)

- Location: `$XDG_DATA_HOME/winvaders/` (default `~/.local/share/winvaders/`).
- `save.json`: level, score, lives, next extra-life threshold, RNG seed. Written at
  each level start (auto-save; call) and on "Save & Quit" from pause. Deleted on game
  over. Continue resumes at the start of the saved level.
- `scores.json`: top 10 `{name, score, level, date}`, sorted score desc, ties by
  earlier date. Name 1-12 chars, defaults to last used name.
- `settings.json`: sound on/off, fullscreen, last name.
- Writes are atomic (write temp + `os.replace`). Corrupt or unreadable files are
  treated as empty and logged, never crash the game.
- All files carry `"version": 1`.

### Sound

Synthesized WAV effects generated by `tools/gen_sounds.py` and committed: shoot, hit
(alien damaged), kill, bosshit, boss (entrance roar), bossdeath (growl), playerhit,
levelup, powerup, extralife, gameover. Played from Python through `QAudioSink`
(`audio.py`, exposed to QML as `Sound`), not QML `SoundEffect`: SoundEffect tags its
stream `media.role=event`, which PipeWire mutes along with notification sounds.
Toggle with `M` or the menu.

### Rendering performance

No `shadowBlur` anywhere: Qt Canvas blurs every primitive drawn under it, which dropped
boss and late levels to a few frames per second. Glows are radial-gradient halos.

### Packaging

- `packaging/PKGBUILD`, following xen-installer's convention: builds from the local
  repo via `_repo_root="${startdir}/.."`, `python -m build --wheel --no-isolation`,
  `python -m installer`.
- `depends=(python pyside6 qt6-declarative qt6-multimedia qt6-wayland)`,
  `makedepends=(python-build python-installer python-hatchling python-wheel)`.
- Installs:
  - `/usr/bin/winvaders` (entry point)
  - `/usr/share/applications/winvaders.desktop` (Categories=Game;ArcadeGame;)
  - `/usr/share/icons/hicolor/scalable/apps/winvaders.svg`
  - `/usr/lib/winvaders/winvaders-shortcut` (POSIX sh) and
    `/etc/xdg/autostart/winvaders-shortcut.desktop`.
- Desktop icon: at login the autostart entry runs the shortcut script once per user.
  It copies the menu .desktop to the XDG desktop dir (`xdg-user-dir DESKTOP`, fallback
  `~/Desktop`) with mode 0755 (trusted by Plasma) and drops a marker in the data dir so a
  user who deletes the icon does not get it back. Not `/etc/skel`: xen-installer's
  `users` job runs before its `packages` removal job, so a skel copy would leave a
  dangling icon on installed systems. With autostart, the live user gets the icon at
  autologin, installed systems never get one (package removed before first login), and
  pacman reinstallers get it at next login.
- The main menu has "Add desktop shortcut" (shown when no icon exists), which runs the
  same script with `--force`.
- Files in the user's home (saves, scores, the copied icon) outlive `pacman -R`, as is
  normal for per-user data; "no leftovers" covers system paths only.
- Maintainer line and url follow xen-installer (`DarkXero`, `https://xerolinux.xyz`).

### Outside this folder (user's checklist, not done by this work)

- Add `winvaders` to the ISO package lists (`~/XeroBuild/FOSS/packages.x86_64`,
  `~/XeroBuild/nVidia/packages.x86_64`) and to the repo.
- Add `winvaders` to the `packages` job `remove:` list in
  `xen-installer/config/xerolinux/xerolinux.yaml` (and the nVidia config).
- qt6-multimedia and a backend are already on the ISO (required by dolphin, konsole,
  spectacle, kirigami-addons), so sound adds no ISO weight.

### Testing

- `pytest` for `storage.py`: save/load round-trip, top-10 insert/ordering/ties,
  qualifies-check, corrupt file recovery, atomic write, XDG path resolution.
- `pytest` for `logic.mjs` run through PySide6 `QJSEngine.importModule`: wave
  generation determinism by seed, tier unlocking, difficulty caps, boss every 3rd
  level, scoring and extra lives.
- Smoke test: launch the app offscreen (`QT_QPA_PLATFORM=offscreen`), load Main.qml,
  assert no QML errors.
- Manual: run locally, play several levels, fullscreen toggle, `makepkg` build and
  inspect package file list.

## Left to the builder

Exact sprite drawings, colors, tuning numbers within the caps, sound synthesis
parameters, menu visual styling (dark arcade look in the xen palette).
