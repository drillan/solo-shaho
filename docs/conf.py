"""Sphinx 設定ファイル."""

project = "solo-shaho"
author = "driller"
copyright = "2026, driller"
release = "0.1.0"

extensions = [
    "myst_parser",
    "sphinx_oceanid",
]

myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "tasklist",
    "attrs_inline",
    "dollarmath",
    "amsmath",
]

myst_heading_anchors = 3

source_suffix = {".md": "markdown"}

language = "ja"
exclude_patterns = [
    "_build",
    "Thumbs.db",
    ".DS_Store",
    "superpowers",
]

html_theme = "shibuya"
html_static_path = ["_static"]
html_title = "solo-shaho ドキュメント"

myst_url_schemes = ("http", "https", "mailto", "ftp")
