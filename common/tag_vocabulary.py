"""The shared tag vocabulary, common/tags.json: one label per tag and the aliases that name it too.

A lesson writes the label in its <ul class="tags">. The search index adds the aliases, so a search for an alias
finds the lesson. The problems in problems_ln map their raw tags to the same labels (tools/find_by_tag.py there).
"""
import json
import pathlib

VOCABULARY_FILE = pathlib.Path(__file__).resolve().parent / "tags.json"


def load():
    """The entries: a list of {"label": str, "aliases": [str]}."""
    return json.loads(VOCABULARY_FILE.read_text(encoding="utf-8"))
