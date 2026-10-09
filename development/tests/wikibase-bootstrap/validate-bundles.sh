#!/usr/bin/env bash

set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_dir="$(cd "$test_dir/../../.." && pwd)"
fixture_dir="$test_dir/fixtures"
bundle_dir="$repository_dir/development/images/wikibase/runtime/var/www/html/extensions/WikibaseBootstrap/ontologies"
profile="$fixture_dir/wikibase-bootstrap-profile.shacl.ttl"

for bundle in \
	"$bundle_dir/wikibase-bootstrap.ttl" \
	"$bundle_dir/wikibase-bootstrap-extended.ttl" \
	"$fixture_dir/wikibase-bootstrap-profile-example.ttl"; do
	python3 -m pyshacl -s "$profile" "$bundle"
done
