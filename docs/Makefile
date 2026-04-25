# Minimal makefile for Sphinx documentation

SPHINXOPTS      ?= -W --keep-going
SPHINXBUILD     ?= uv run --group docs sphinx-build
SPHINXAUTOBUILD ?= uv run --group docs sphinx-autobuild
SOURCEDIR       = .
BUILDDIR        = _build
PORT            ?= 8000

.PHONY: help clean html serve livehtml

help:
	@$(SPHINXBUILD) -M help "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

clean:
	rm -rf $(BUILDDIR)/*

html:
	$(SPHINXBUILD) -M html "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

serve: html
	@echo "Serving at http://localhost:$(PORT) — press Ctrl+C to stop"
	uv run python -m http.server -d $(BUILDDIR)/html $(PORT)

livehtml:
	$(SPHINXAUTOBUILD) "$(SOURCEDIR)" "$(BUILDDIR)/html" $(SPHINXOPTS) $(O)

%:
	@$(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)
