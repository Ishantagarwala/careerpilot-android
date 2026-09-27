#!/usr/bin/env python3
"""Render screens.py to PNGs at true Android density (412x915 @2x)."""
import pathlib, subprocess, sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
from screens import SCREENS  # noqa: E402

OUT = HERE / "png"
OUT.mkdir(exist_ok=True)

for name, html in SCREENS.items():
    (HERE / f"{name}.html").write_text(html)
    print("wrote", name)

node = HERE / "shot.mjs"
r = subprocess.run(["node", str(node)], cwd=HERE, capture_output=True, text=True)
print(r.stdout)
if r.returncode != 0:
    print(r.stderr, file=sys.stderr)
    sys.exit(r.returncode)
