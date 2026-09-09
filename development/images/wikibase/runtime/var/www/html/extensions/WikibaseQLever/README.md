# Wikibase QLever extension

This bundled extension provides the internal full-export endpoint used by the
Wikibase Suite QLever integration. It serializes entity RDF with Wikibase's
`EntityDataSerializationService`, the same RDF implementation used by
`Special:EntityData`, while selecting a bounded group of entity pages in one
request.

`action=qleverexport` accepts a page-ID cursor (`after`) and an entity count
(`limit`, from 1 through 500). It returns entity-framed N-Triples, the next
cursor when more pages remain, and a `complete` value of `"1"` or `"0"`. The
QLever updater turns each entity record into an
entity-owned N-Quads graph and persists its completed chunks before requesting
the next one.

The endpoint has no useful default credential. Set `QLEVER_EXPORT_TOKEN_FILE`
to a readable file containing the shared token, or set
`$wgQleverExportTokenFile` in local configuration. Requests supply that value
in `X-Wikibase-QLever-Export-Token`; the deliberately nonstandard header
avoids collision with the bundled OAuth extension's `Authorization` handling.
Requests without the token are rejected. In the Suite Compose wiring, the
updater creates the token in `query-data` with restrictive permissions and
Wikibase mounts that volume read-only.

This is an integration endpoint, not a public bulk-download API. The extension
name intentionally leaves room for further Wikibase-side QLever integration
without treating this first export endpoint as its permanent boundary.
