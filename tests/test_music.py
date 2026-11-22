import time

from PySide6.QtCore import QIODevice

from winvaders import music


def wait_until(predicate, qapp, timeout=15):
    deadline = time.time() + timeout
    while not predicate() and time.time() < deadline:
        qapp.processEvents()
        time.sleep(0.02)
    return predicate()


def peak(data):
    samples = memoryview(data).cast("h")
    return max(max(samples), -min(samples))


def test_songs_cover_menu_level_and_bosses(logic):
    assert set(music.SONGS) == {"menu", "level", *logic.get("BOSSES")}


def test_stems_share_the_grid_and_never_clip(logic):
    for name in music.SONGS:
        stems = music.render_stems(name)
        assert set(stems) == {"lead", "bass", "drums"}
        assert {len(s) for s in stems.values()} == {music.LOOP_SAMPLES}
        assert peak(music.track_bytes(name)) < 32767
    bosses = logic.get("BOSSES")
    for body, guest in zip(bosses, bosses[3:] + bosses[:3]):
        assert peak(music.track_bytes(f"{body}+{guest}")) < 32767
    for name in ("clippy", "bsod", "kinect"):
        stems = music.render_stems(name)
        assert any(stems["lead"]) and any(stems["bass"]) and any(stems["drums"])


def test_bosses_sound_different(logic):
    tracks = {name: music.track_bytes(name) for name in music.SONGS}
    assert len(set(tracks.values())) == len(tracks)


def test_fusion_mix_uses_body_lead_and_guest_rhythm():
    a, b = music.render_stems("clippy"), music.render_stems("teamsboss")
    expected = music.mix([a["lead"], b["bass"], b["drums"]])
    assert music.track_bytes("clippy+teamsboss") == expected
    assert len(expected) == music.LOOP_SAMPLES * 2


def test_loop_device_wraps():
    dev = music.LoopDevice(b"abcdef")
    dev.open(QIODevice.ReadOnly)
    assert bytes(dev.read(4)) == b"abcd" and bytes(dev.read(4)) == b"efab"


def test_render_all_is_fast_enough():
    music._note_wave.cache_clear()
    music._drum_wave.cache_clear()
    music._drum_hit.cache_clear()
    start = time.perf_counter()
    music.render_stems("menu")
    menu = time.perf_counter() - start
    for name in music.SONGS:
        music.render_stems(name)
    total = time.perf_counter() - start
    print(f"menu {menu:.2f}s all {total:.2f}s")
    assert menu < 1.5 and total < 15


def test_player_state(qapp):
    p = music.MusicPlayer()
    p.setEnabled(False)
    assert p.play("menu") is True
    assert p.current == "menu" and not p.isPlaying()
    p.setEnabled(True)
    assert wait_until(p.isPlaying, qapp)
    p.pause()
    assert p.paused and not p.isPlaying()
    p.resume()
    assert not p.paused and p.isPlaying()
    assert p.play("nope") is False
    assert p.current == "menu"
    p.play("clippy+teamsboss")
    assert wait_until(p.isPlaying, qapp)
    p.stop()
    assert p.current == "" and not p.isPlaying()
