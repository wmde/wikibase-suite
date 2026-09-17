# Bundled bootstrap ontologies

These files are reviewed source assets for the in-development bootstrap
extension at `/var/www/html/extensions/WikibaseBootstrap/ontologies/`; no
runtime network request is made to obtain them.

Source: [`olea/wikibase-bootstrap`](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/),
commit `40892e31fd812c9b1402506d1ee86cfc215e1dd6` (2026-04-08).

The source ontology data declares CC0 1.0 Universal. The Suite copies its
semantic content into the local-ID-independent Suite profile: source IRIs are
stable keys, while the server-owned importer allocates the actual local `P…`
IDs. The upstream Python importer is intentionally not used because it assumes
fixed local IDs.

The minimal and extended variants remain separate user-visible choices.

The same server-owned operation is available without the Special page:

```sh
php extensions/WikibaseBootstrap/maintenance/BootstrapOntology.php \
  --bundle extended --user Admin --confirm
```

Run this command from the MediaWiki installation directory. It only applies to
an eligible empty Wikibase, just like the Special page.

The feature-local validation assets and pySHACL runner live in
`development/tests/wikibase-bootstrap/`. They are deliberately not production
dependencies or an upload validator yet.
