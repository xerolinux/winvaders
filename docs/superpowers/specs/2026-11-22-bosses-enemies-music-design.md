# WinVaders v1.1: Bosses, Enemies, Music - Design

## Intent

Players found the game repetitive: only 3 bosses cycle every 3 levels, and 22 enemy
types are drawn at random from level 1 on, so every level looks alike. The owner
wants the game to feel like it never ends: always something new to meet. On top,
subtle 80s chiptune background music, a different theme per boss.

## Goals

- 12 unique hand-drawn bosses, one per boss level (levels 3, 6, ... 36), each with
  its own look, attack and music theme.
- From level 39 on, fusion bosses: two of the 12 combined. Endless without repeats
  a player will notice.
- Enemy roster grows from 22 to 40 types, unlocked gradually so later levels look
  different from early ones.
- Quiet chiptune music: a menu track, a normal-level track, and one theme per boss.
  It never drowns out sound effects.
- Separate Music on/off (menu item + `N` key), independent of Sound (`M`).

## Non-goals

- Procedurally generated boss art (rejected: looks generic).
- Licensed or sampled music. Everything is synthesized from original note data.
- Changing the existing difficulty curve for regular waves (`difficulty(level)`).

## Anti-goals

- Music loud enough to compete with sound effects.
- Boss mechanics that feel unfair: unavoidable hits, long loss of control.
- A noticeably bigger package or slower start: music must not add megabytes or block
  the UI.
- Real Microsoft logo artwork. Same rule as v1: original vector parody drawings.

## Constraints

- Everything from the v1 spec still holds: PySide6 + QML, Canvas 2D, no
  `shadowBlur`, 62.5 ticks/s on every level, `QAudioSink` (not `SoundEffect`),
  no new dependencies (no numpy), saves stay valid.
- Old saves (`version: 1`) must still load. A save stores `level` and `seed`; the
  boss for a level, including a fusion pair, must be derivable from those two alone.

## Approaches considered (after level 36)

- **A. Fusion bosses (chosen).** Body of one boss, attacks and accents of another.
  132 ordered pairs; reuses existing art. Picked by the owner.
- B. Shuffled return of the 12 as Mk 2, Mk 3: simple, but repeats are noticeable.
- C. Procedural bosses: truly endless, but generic looking.

Music storage, my call: tracks are note data in code, rendered to PCM at runtime,
instead of shipping ~13 MB of WAVs.

## Bosses

Order, level, and signature attack (easier mechanics first):

| # | Level | Boss | Attack |
|---|-------|------|--------|
| 1 | 3 | Clippy (exists) | fan of paperclips |
| 2 | 6 | Cortana | slow homing rings, steer toward player for ~1.5 s then fly straight |
| 3 | 9 | Zune | sine-wave sound bullets |
| 4 | 12 | Blue Screen of Death (exists) | falling error blocks |
| 5 | 15 | Internet Explorer | "e" orbs that stop mid-air ("loading"), then drop fast |
| 6 | 18 | Microsoft Bob | spawns 2-4 small puppy minions that walk down and shoot (see below) |
| 7 | 21 | Red Ring of Death | expanding ring that leaves a gap to dodge through |
| 8 | 24 | Teams | "You're muted" bubbles; a hit disables firing for 1.5 s max. Bubbles are shootable. |
| 9 | 27 | Windows Update (exists) | progress-bar wall with one gap |
| 10 | 30 | Kinect | tracking beam: telegraphed line on player x, fires after ~0.8 s |
| 11 | 33 | UAC "Allow?" prompt | "Allow?" walls that block player shots until shot through |
| 12 | 36 | Copilot | mirrors the player's recent shots back down, plus a spread |

- Each boss: own drawing in `sprites.mjs` (same quality bar as Clippy / BSOD /
  Windows Update: gradients, faces, animation, rage state at low HP), own attack
  in `Game.qml`, own bullet look, own banner name, own death growl reuse is fine.
- Bob's puppies are their own entity list, not `aliens`: 1 hp, 10 points, no
  power-up drops, they vanish when Bob dies and never block the level clear
  (my call).
- Within levels 3-36 each boss uses only its own attack. Remove the current
  "borrowed attacks from k >= 4" rule and the "Mk k" label for unique bosses.
- Stats keep scaling with `k` (boss number) using the existing `bossStats`
  curves (hp, attack rate, bullet speed, speed, descent). Attack parameters may also
  scale with `k` (more bullets, faster).

## Fusion bosses (level 39+)

- Pair `(body, guest)`, `body != guest`. The 132 pairs are put in one fixed
  shuffled order (fixed constant seed), and fusion number `n = k - 12` takes pair
  `n % 132`. Derived from `level` alone, so saves need no new fields and no pair
  repeats for 132 fusion levels (my call; the per-level `seed` is rerolled each
  level and cannot drive a no-repeat order).
- Look: body's full drawing, guest's mini icons orbiting (existing `MINI_ICON`
  idea, extended to all 12), aura tinted with the guest's accent colour.
- Attacks: alternates body and guest attacks.
- Name: `"<Body> x <Guest>"` on the banner, e.g. "CLIPPY x TEAMS", subtitle
  "FUSION".
- Stats continue scaling with `k`, existing caps apply.

## Enemies

- 18 new types, 40 total. Tier stats unchanged (hp/points: 1/10, 1/20, 2/30, 2/50).
  - Tier 1: Calculator, Solitaire, Minesweeper, Sticky Notes, Snipping Tool, WordPad
  - Tier 2: SharePoint, Visio, Project, Planner, MSN
  - Tier 3: Windows Media Player, Movie Maker, Silverlight, Groove Music
  - Tier 4: SQL Server, Dynamics 365, HoloLens
- All 40 types (old and new) get an unlock level, so some v1 types now appear later.
  Level 1 starts with 8 types; 2-3 new types unlock on levels 4, 7, 10, ... (never a
  boss level) until all 40 are in (around level 45). Tier gating from v1 still
  applies (a type never appears before its tier unlocks). Per-tier hp and points
  stay the same, so this does not change difficulty.
- Wave generation favours types unlocked in the last 6 levels, so new arrivals
  show up right away.
- Types unlocked on a level are guaranteed a row in that level's wave, and the
  banner shows "NEW: <name>" for them. Tied to the unlock level, so it shows every
  run and needs no saved state (my call).

## Music

- Tracks: `menu`, `level`, and one theme per boss (12). Fusion: body's melody over
  guest's bass and drums.
- All 14 tracks share one grid: 128 BPM, A minor, 16 bars, so any boss melody fits
  any other boss's bass and drums. Each track is rendered as stems (lead, bass,
  drums); a fusion mixes stems on demand when the boss banner shows (my call).
- Style: 80s chip: square/pulse lead, triangle bass, noise drums, seamless loop point. Original compositions.
- Volume: music around 25% of effect loudness in game, about 15% in the menu.
  Must be checked by ear on the user's machine.
- Behaviour:
  - Menu, high scores, name entry: menu track.
  - Level start: level track. Boss level: boss theme from the banner on.
  - Boss killed: music stops for the level clear; next level resumes level track.
  - Pause: music pauses. Game over: music stops.
- Rendering: note data lives in Python, rendered to 22050 Hz mono 16-bit PCM in a
  background thread at startup (menu track first). Cached for the session. UI never
  blocks; if a track is not rendered yet, play nothing and start it when ready.
- Playback: one dedicated looping `QAudioSink`, outside the 8 effect voices.
- Settings: new key `music` (default `true`) in `settings.json`; old settings files
  without it load with the default.

## Menu and controls

- New menu item "Music: On/Off" next to "Sound".
- `N` toggles music in game and menu; HUD shows a music icon next to the sound icon.
- README controls are not listed (README is gif + description + install only).

## Left to the builder

- Exact boss art, colours, speech lines, minion and bullet visuals.
- Exact melodies and drum patterns; exact unlock table for the 40 types.
- Crossfade or hard cut between tracks.
- Tuning numbers for new attacks, within the fairness rules above.
- The recording script for the README gif may be re-run to show new content.
