#!/usr/bin/env python3
"""Print the CHANGELOG.md section for a version, used as the GitHub release body."""
import sys
from pathlib import Path


def notes(version: str, changelog: Path) -> str:
    out, inside = [], False
    for line in changelog.read_text().splitlines():
        if line.startswith("## "):
            if inside:
                break
            inside = line[3:].strip().removeprefix("v") == version
        elif inside:
            out.append(line)
    return "\n".join(out).strip()


if __name__ == "__main__":
    version = sys.argv[1].removeprefix("v")
    path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "CHANGELOG.md"
    text = notes(version, path)
    if not text:
        sys.exit(f"no CHANGELOG.md section for {version}")
    print(text)
