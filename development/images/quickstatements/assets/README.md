# ToolTranslate snapshot

`tooltranslate/data/quickstatements/en.json` is the English QuickStatements translation snapshot archived from Toolforge on 18 June 2026:

https://web.archive.org/web/20260618133801id_/https://tools-static.wmflabs.org/tooltranslate/data/quickstatements/en.json

The archived file's SHA-256 is `67dcafbe2e4851d088f5a1490a805fc18a5103f1e24deada58ed31be424f7674`. The bundled copy removes JSON's optional escaped slashes for lint compatibility; it has identical translation values and SHA-256 `f60194368faf6cd9763308d9c7d11c658d2c24ae1da1d5f6661d0f55b2c9eafa`. `toolinfo.json` and `languages.json` are reduced local metadata for the bundled English translation. [ToolTranslate's archived QuickStatements index](https://web.archive.org/web/20261015231230id_/https://tools-static.wmflabs.org/tooltranslate/data/quickstatements/toolinfo.json) lists 47 languages, but a complete multilingual export was not available during the Toolforge outage. ToolTranslate generates these JSON files from its translation database rather than storing them in the QuickStatements repository. Replace this snapshot with an up-to-date, complete export when ToolTranslate is available again.

The JavaScript and CSS packages are fetched from their pinned upstream distributions during the image build, with checksums in `prepare-static-assets.sh`. MagnusTools Vue templates and browser resources come from the source commit pinned in `docker-bake.hcl`. `local-static-assets.patch` redirects the pinned upstream files to these bundled paths and is checked before application during the build.
