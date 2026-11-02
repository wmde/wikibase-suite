# Bundled bootstrap ontology

`ontologies/wikibase-bootstrap.ttl` is a byte-for-byte copy of the reviewed
small property set from [`olea/wikibase-bootstrap`](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/),
commit `40892e31fd812c9b1402506d1ee86cfc215e1dd6` (2026-04-08).
Its SHA-256 is `49e87c0e78d3bf5bf8dc28f3260e0ad407c5dbcf3075aac80b7fa2595c29643b`.
No runtime network request is made to obtain it.

The source declares CC0 1.0 Universal. Its `wb:P…` identifiers and matching
`Wikibase ID` notes serve as source keys. The Suite importer lets Wikibase
allocate local property IDs, then maps source-key statements to those IDs.
As in the upstream importer, `owl:equivalentProperty` creates an exact-match
statement using the property identified by source key `wb:P5`.

The importer reads the property conventions used by this pinned file, including
additional properties in the same supported form. It rejects unsupported
predicates and claim datatypes. It does not accept uploaded Turtle files or
provide a general RDF/OWL import facility.

The small property set is the only bundled import option.

The same server-owned operation is available without the Special page:

```sh
php extensions/WikibaseBootstrap/maintenance/BootstrapOntology.php \
  --user Admin --confirm
```

Run this command from the MediaWiki installation directory. It only applies to
an eligible Wikibase without active properties, just like the Special page.

The tests in `development/tests/wikibase-bootstrap/` check the bundled file's
SHA-256 and the import plan, including source-key references. The running
extension has no Python or RDF parser dependency.
