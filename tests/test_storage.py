import json
import os
from pathlib import Path

import pytest

from winvaders.storage import MAX_NAME, MAX_SCORES, Storage, data_dir

FULL_SAVE = {"level": 3, "score": 1200, "lives": 2, "next_life": 10000, "seed": 42}


def test_data_dir_respects_xdg(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    assert data_dir() == tmp_path / "winvaders"
    monkeypatch.delenv("XDG_DATA_HOME")
    assert data_dir() == Path.home() / ".local/share/winvaders"


def test_save_roundtrip(tmp_path):
    s = Storage(tmp_path)
    s.write_save(FULL_SAVE)
    loaded = s.load_save()
    assert {k: loaded[k] for k in FULL_SAVE} == FULL_SAVE
    assert s.has_save()
    s.clear_save()
    assert s.load_save() is None
    assert not s.has_save()


@pytest.mark.parametrize(
    "content",
    [
        json.dumps({"version": 1, "level": 3}),
        json.dumps({"version": 99, **FULL_SAVE}),
        "{not json",
        json.dumps([1, 2, 3]),
    ],
)
def test_invalid_save_ignored(tmp_path, content):
    (tmp_path / "save.json").write_text(content)
    s = Storage(tmp_path)
    assert s.load_save() is None
    assert not s.has_save()


def test_scores_sorted_and_capped(tmp_path):
    s = Storage(tmp_path)
    for i in range(12):
        s.add_score(f"p{i}", (i + 1) * 100, 1, f"2026-01-{i + 1:02d}")
    scores = s.load_scores()
    assert len(scores) == MAX_SCORES == 10
    values = [e["score"] for e in scores]
    assert values == sorted(values, reverse=True)
    assert 100 not in values and 200 not in values


def test_score_ties_keep_earlier_first(tmp_path):
    s = Storage(tmp_path)
    assert s.add_score("A", 500, 1, "2026-01-01") == 0
    assert s.add_score("B", 500, 1, "2026-01-02") == 1
    assert [e["name"] for e in s.load_scores()] == ["A", "B"]


def test_qualifies(tmp_path):
    s = Storage(tmp_path)
    assert s.qualifies(0) is False
    assert s.qualifies(10) is True
    for i in range(10):
        s.add_score("x", 100 + i * 10, 1, "2026-01-01")
    assert s.qualifies(100) is False
    assert s.qualifies(101) is True
    assert s.add_score("late", 50, 1) == -1


@pytest.mark.parametrize(
    "raw,expected",
    [("  bob  ", "bob"), ("a" * 40, "a" * MAX_NAME), ("   ", "PLAYER"), ("", "PLAYER"), ("🚀🚀", "🚀🚀")],
)
def test_name_sanitized(tmp_path, raw, expected):
    s = Storage(tmp_path)
    s.add_score(raw, 100, 1)
    assert s.load_scores()[0]["name"] == expected


def test_corrupt_scores_and_settings_recover(tmp_path):
    (tmp_path / "scores.json").write_text("garbage")
    (tmp_path / "settings.json").write_text("{{{")
    s = Storage(tmp_path)
    assert s.load_scores() == []
    assert s.load_settings() == {"sound": True, "music": True, "fullscreen": False, "last_name": ""}


def test_settings_roundtrip(tmp_path):
    s = Storage(tmp_path)
    s.save_settings({"sound": False, "music": False, "fullscreen": True, "last_name": "zed"})
    assert s.load_settings() == {"sound": False, "music": False, "fullscreen": True, "last_name": "zed"}


@pytest.mark.skipif(os.geteuid() == 0, reason="root ignores permissions")
def test_unwritable_dir_does_not_raise(tmp_path):
    base = tmp_path / "ro"
    base.mkdir()
    base.chmod(0o500)
    try:
        s = Storage(base)
        s.write_save(FULL_SAVE)
        s.add_score("bob", 100, 1)
        s.save_settings({"sound": False})
        assert s.load_save() is None
    finally:
        base.chmod(0o700)


def test_atomic_write_leaves_no_tmp(tmp_path):
    s = Storage(tmp_path)
    s.write_save(FULL_SAVE)
    s.add_score("bob", 100, 1)
    s.save_settings({"sound": False})
    assert list(tmp_path.glob("*.tmp")) == []


@pytest.mark.parametrize(
    "patch",
    [{"level": -3}, {"level": 0}, {"lives": 0}, {"score": -1}, {"next_life": 0}, {"seed": True}, {"level": True}],
)
def test_out_of_range_save_ignored(tmp_path, patch):
    (tmp_path / "save.json").write_text(json.dumps({"version": 1, **FULL_SAVE, **patch}))
    assert Storage(tmp_path).load_save() is None


def test_unencodable_name_does_not_raise(tmp_path):
    s = Storage(tmp_path)
    assert s.add_score("a\ud800b", 100, 1) == 0
    assert s.load_scores()[0]["name"] == "ab"
    assert list(tmp_path.glob("*.tmp")) == []


def test_deeply_nested_json_ignored(tmp_path):
    (tmp_path / "scores.json").write_text("[" * 100000)
    assert Storage(tmp_path).load_scores() == []


def test_settings_default_music(tmp_path):
    s = Storage(tmp_path)
    assert s.load_settings()["music"] is True
    (tmp_path / "settings.json").write_text('{"version": 1, "sound": false}')
    assert s.load_settings()["music"] is True
