from winvaders.audio import SoundBoard, SOUNDS_DIR

from test_sounds import NAMES


def test_board_loads_every_sound(qapp):
    board = SoundBoard(SOUNDS_DIR)
    assert set(board.names()) == NAMES


def test_play_known_and_unknown(qapp):
    board = SoundBoard(SOUNDS_DIR)
    assert board.play("kill") is True
    assert board.play("kill") is True
    assert board.play("nope") is False


def test_disabled_board_is_silent(qapp):
    board = SoundBoard(SOUNDS_DIR)
    board.setEnabled(False)
    assert board.play("kill") is False


def test_finished_voices_are_released(qapp):
    import time

    board = SoundBoard(SOUNDS_DIR)
    board.play("hit")
    deadline = time.time() + 3
    while board.voices and time.time() < deadline:
        qapp.processEvents()
        time.sleep(0.02)
    assert board.voices == []
