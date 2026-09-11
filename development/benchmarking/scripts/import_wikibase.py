#!/usr/bin/env python3
"""Import a generated benchmark corpus through the MediaWiki Action API.

The importer deliberately uses only the supported Action API. It first creates
properties and item shells, records every source-to-local ID mapping, then adds
claims in a second pass so forward references and cycles are valid. The state
file makes a long import resumable after a process or network interruption.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import ssl
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPSHandler, HTTPCookieProcessor, Request, build_opener
import http.cookiejar

Entity = dict[str, Any]
TERM_VALUE_LIMITS = {"labels": 250, "descriptions": 400, "aliases": 250}


class ApiError(RuntimeError):
    """A MediaWiki Action API request failed."""


class ActionApi:
    def __init__(self, url: str, insecure: bool = False) -> None:
        self.url = url
        handlers: list[Any] = [HTTPCookieProcessor(http.cookiejar.CookieJar())]
        if insecure:
            handlers.append(HTTPSHandler(context=ssl._create_unverified_context()))
        self.opener = build_opener(*handlers)
        self.csrf_token: str | None = None

    def request(self, parameters: dict[str, str], post: bool = False) -> dict[str, Any]:
        parameters = {"format": "json", "formatversion": "2", **parameters}
        encoded = urlencode(parameters).encode()
        request = Request(self.url, data=encoded if post else None)
        if not post:
            request = Request(f"{self.url}?{urlencode(parameters)}")
        try:
            with self.opener.open(request, timeout=120) as response:
                payload = json.load(response)
        except (HTTPError, URLError, TimeoutError) as error:
            raise ApiError(f"Action API request failed: {error}") from error
        if not isinstance(payload, dict):
            raise ApiError("Action API returned a non-object response.")
        if "error" in payload:
            error = payload["error"]
            raise ApiError(
                f"Action API error: {error.get('code')}: {error.get('info')}"
            )
        return payload

    def login(self, username: str, password: str) -> None:
        token_response = self.request(
            {"action": "query", "meta": "tokens", "type": "login"}
        )
        token = token_response["query"]["tokens"]["logintoken"]
        response = self.request(
            {
                "action": "login",
                "lgname": username,
                "lgpassword": password,
                "lgtoken": token,
            },
            post=True,
        )
        if response.get("login", {}).get("result") != "Success":
            raise ApiError(f"Login failed: {response.get('login')}")
        self.csrf_token = self.request({"action": "query", "meta": "tokens"})["query"][
            "tokens"
        ]["csrftoken"]

    def edit_entity(self, parameters: dict[str, str]) -> Entity:
        if not self.csrf_token:
            raise RuntimeError("Log in before editing entities.")
        response = self.request(
            {"action": "wbeditentity", "token": self.csrf_token, **parameters},
            post=True,
        )
        entity = response.get("entity")
        if not isinstance(entity, dict) or not isinstance(entity.get("id"), str):
            raise ApiError(f"wbeditentity did not return an entity ID: {response}")
        return entity

    def find_entity_by_label(self, label: str, entity_type: str) -> str | None:
        """Find one exact English-label match for interrupted-import recovery."""
        response = self.request(
            {
                "action": "wbsearchentities",
                "search": label,
                "language": "en",
                "type": entity_type,
                "limit": "10",
            }
        )
        matches = [
            result.get("id")
            for result in response.get("search", [])
            if isinstance(result, dict)
            and result.get("label") == label
            and isinstance(result.get("id"), str)
        ]
        if len(matches) > 1:
            raise ApiError(
                f"Found multiple {entity_type} entities labelled {label!r}; cannot resume safely."
            )
        return matches[0] if matches else None

    def supported_languages(self) -> set[str]:
        """Return language codes enabled by the target MediaWiki installation."""
        response = self.request(
            {"action": "query", "meta": "siteinfo", "siprop": "languages"}
        )
        languages = response.get("query", {}).get("languages", [])
        return {
            language["code"]
            for language in languages
            if isinstance(language, dict) and isinstance(language.get("code"), str)
        }

    def has_wikibase_entities(self) -> bool:
        for namespace in ("120", "122"):
            response = self.request(
                {
                    "action": "query",
                    "list": "allpages",
                    "apnamespace": namespace,
                    "aplimit": "1",
                }
            )
            if response.get("query", {}).get("allpages"):
                return True
        return False


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}.")
    return value


def read_entities(path: Path) -> list[Entity]:
    entities: list[Entity] = []
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            entity = json.loads(line)
            if not isinstance(entity, dict) or entity.get("type") != "item":
                raise ValueError(f"Expected an item on line {line_number} of {path}.")
            entities.append(entity)
    return entities


def source_checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def terms(
    entity: Entity,
    label_prefix: str = "",
    supported_languages: set[str] | None = None,
) -> dict[str, Any]:
    copied: dict[str, dict[str, Any]] = {}
    for name, limit in TERM_VALUE_LIMITS.items():
        source_terms = entity.get(name)
        if not isinstance(source_terms, dict):
            continue
        retained_terms = {}
        for language, term in source_terms.items():
            if not isinstance(term, dict) or not isinstance(term.get("value"), str):
                continue
            if supported_languages is not None and language not in supported_languages:
                continue
            value = term["value"]
            if name == "labels":
                value = f"{label_prefix}{value}"
                if label_prefix:
                    source_id = entity.get("id")
                    if isinstance(source_id, str):
                        suffix = f" ({source_id})"
                        value = f"{value[: limit - len(suffix)]}{suffix}"
            retained_terms[language] = {**term, "value": value[:limit]}
        if retained_terms:
            copied[name] = retained_terms
    return copied


def mapped_identifier(identifier: str, identifiers: dict[str, str]) -> str:
    try:
        return identifiers[identifier]
    except KeyError as error:
        raise ValueError(f"Corpus refers to unmapped entity {identifier}.") from error


def numeric_id(identifier: str) -> int | None:
    suffix = identifier[1:]
    return int(suffix) if suffix.isdigit() else None


def portable_datavalue(datavalue: dict[str, Any]) -> dict[str, Any]:
    """Constrain copied scalar values to Wikibase's portable field limits."""
    copied = copy.deepcopy(datavalue)
    if copied.get("type") == "string" and isinstance(copied.get("value"), str):
        copied["value"] = copied["value"][:400]
    if copied.get("type") == "monolingualtext" and isinstance(
        copied.get("value"), dict
    ):
        value = copied["value"]
        if isinstance(value.get("text"), str):
            copied["value"] = {**value, "text": value["text"][:400]}
    return copied


def rewrite_snak(snak: dict[str, Any], identifiers: dict[str, str]) -> dict[str, Any]:
    rewritten = {
        name: copy.deepcopy(value)
        for name, value in snak.items()
        if name in {"snaktype", "datatype", "datavalue", "property"}
    }
    property_id = rewritten.get("property")
    if not isinstance(property_id, str):
        raise ValueError("A claim snak has no property ID.")
    rewritten["property"] = mapped_identifier(property_id, identifiers)
    datavalue = rewritten.get("datavalue")
    if not isinstance(datavalue, dict) or datavalue.get("type") != "wikibase-entityid":
        if isinstance(datavalue, dict):
            rewritten["datavalue"] = portable_datavalue(datavalue)
        return rewritten
    value = datavalue.get("value")
    if not isinstance(value, dict) or not isinstance(value.get("id"), str):
        raise ValueError("A Wikibase entity value has no entity ID.")
    target = mapped_identifier(value["id"], identifiers)
    rewritten["datavalue"] = {
        **datavalue,
        "value": {
            **value,
            "id": target,
            "numeric-id": numeric_id(target),
        },
    }
    return rewritten


def rewrite_claim(claim: dict[str, Any], identifiers: dict[str, str]) -> dict[str, Any]:
    mainsnak = claim.get("mainsnak")
    if not isinstance(mainsnak, dict):
        raise ValueError("A claim has no mainsnak.")
    rewritten: dict[str, Any] = {
        "type": "statement",
        "rank": claim.get("rank", "normal"),
        "mainsnak": rewrite_snak(mainsnak, identifiers),
    }
    qualifiers: dict[str, list[dict[str, Any]]] = {}
    for source_property, snaks in claim.get("qualifiers", {}).items():
        if not isinstance(snaks, list):
            continue
        qualifiers[mapped_identifier(source_property, identifiers)] = [
            rewrite_snak(snak, identifiers) for snak in snaks if isinstance(snak, dict)
        ]
    if qualifiers:
        rewritten["qualifiers"] = qualifiers
        rewritten["qualifiers-order"] = list(qualifiers)

    references = []
    for reference in claim.get("references", []):
        if not isinstance(reference, dict):
            continue
        snaks: dict[str, list[dict[str, Any]]] = {}
        for source_property, values in reference.get("snaks", {}).items():
            if not isinstance(values, list):
                continue
            snaks[mapped_identifier(source_property, identifiers)] = [
                rewrite_snak(value, identifiers)
                for value in values
                if isinstance(value, dict)
            ]
        if snaks:
            references.append({"snaks": snaks, "snaks-order": list(snaks)})
    if references:
        rewritten["references"] = references
    return rewritten


def rewrite_claims(
    entity: Entity, identifiers: dict[str, str]
) -> dict[str, list[dict[str, Any]]]:
    claims: dict[str, list[dict[str, Any]]] = {}
    for source_property, values in entity.get("claims", {}).items():
        if not isinstance(values, list):
            continue
        target_property = mapped_identifier(source_property, identifiers)
        claims[target_property] = [
            rewrite_claim(claim, identifiers)
            for claim in values
            if isinstance(claim, dict)
        ]
    return claims


def snaks_from_claim(claim: dict[str, Any]) -> Iterable[dict[str, Any]]:
    mainsnak = claim.get("mainsnak")
    if isinstance(mainsnak, dict):
        yield mainsnak
    for values in claim.get("qualifiers", {}).values():
        if isinstance(values, list):
            yield from (snak for snak in values if isinstance(snak, dict))
    for reference in claim.get("references", []):
        if not isinstance(reference, dict):
            continue
        for values in reference.get("snaks", {}).values():
            if isinstance(values, list):
                yield from (snak for snak in values if isinstance(snak, dict))


def referenced_properties(entities: Iterable[Entity]) -> set[str]:
    properties: set[str] = set()
    for entity in entities:
        for claim_values in entity.get("claims", {}).values():
            if not isinstance(claim_values, list):
                continue
            for claim in claim_values:
                if not isinstance(claim, dict):
                    continue
                for snak in snaks_from_claim(claim):
                    property_id = snak.get("property")
                    if isinstance(property_id, str):
                        properties.add(property_id)
    return properties


def snak_has_external_item_reference(snak: dict[str, Any], item_ids: set[str]) -> bool:
    """Whether a snak points to an item omitted from a limited smoke subset."""
    datavalue = snak.get("datavalue")
    if not isinstance(datavalue, dict) or datavalue.get("type") != "wikibase-entityid":
        return False
    value = datavalue.get("value")
    if not isinstance(value, dict):
        return False
    identifier = value.get("id")
    return (
        isinstance(identifier, str)
        and identifier.startswith("Q")
        and identifier not in item_ids
    )


def closed_smoke_subset(entities: list[Entity], limit: int | None) -> list[Entity]:
    """Return a self-contained prefix suitable for a small import smoke test.

    The normal corpus is connected across its complete selected item set. A plain
    prefix would therefore retain claims whose item values have not been created
    in the smoke run. This preserves claims internal to the prefix and removes
    only snaks which point outside it.
    """
    if limit is None:
        return entities
    selected = entities[:limit]
    item_ids = {entity["id"] for entity in selected}
    subset: list[Entity] = []
    for entity in selected:
        compact = copy.deepcopy(entity)
        claims: dict[str, list[dict[str, Any]]] = {}
        for property_id, values in compact.get("claims", {}).items():
            if not isinstance(values, list):
                continue
            retained_claims: list[dict[str, Any]] = []
            for claim in values:
                if not isinstance(claim, dict):
                    continue
                mainsnak = claim.get("mainsnak")
                if not isinstance(mainsnak, dict) or snak_has_external_item_reference(
                    mainsnak, item_ids
                ):
                    continue
                qualifiers = {
                    qualifier_property: [
                        snak
                        for snak in snaks
                        if isinstance(snak, dict)
                        and not snak_has_external_item_reference(snak, item_ids)
                    ]
                    for qualifier_property, snaks in claim.get("qualifiers", {}).items()
                    if isinstance(snaks, list)
                }
                references = []
                for reference in claim.get("references", []):
                    if not isinstance(reference, dict):
                        continue
                    snaks = {
                        reference_property: [
                            snak
                            for snak in reference_snaks
                            if isinstance(snak, dict)
                            and not snak_has_external_item_reference(snak, item_ids)
                        ]
                        for reference_property, reference_snaks in reference.get(
                            "snaks", {}
                        ).items()
                        if isinstance(reference_snaks, list)
                    }
                    snaks = {key: value for key, value in snaks.items() if value}
                    if snaks:
                        references.append({"snaks": snaks})
                claim = {
                    **claim,
                    "qualifiers": {
                        key: value for key, value in qualifiers.items() if value
                    },
                    "references": references,
                }
                retained_claims.append(claim)
            if retained_claims:
                claims[property_id] = retained_claims
        compact["claims"] = claims
        subset.append(compact)
    return subset


def load_state(path: Path, corpus_sha256: str) -> dict[str, Any]:
    if not path.exists():
        return {
            "format": "wbs-benchmark-import-state/v1",
            "corpus_sha256": corpus_sha256,
            "properties": {},
            "items": {},
            "claims_completed": [],
            "started_at": datetime.now(UTC).isoformat(),
        }
    state = read_json(path)
    if state.get("corpus_sha256") != corpus_sha256:
        raise ValueError("The existing state belongs to a different corpus file.")
    return state


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def update_progress(
    state: dict[str, Any], phase: str, property_total: int, item_total: int
) -> None:
    """Keep directly-readable durable progress beside source-to-target mappings."""
    state["progress"] = {
        "phase": phase,
        "properties_created": len(state["properties"]),
        "properties_total": property_total,
        "items_created": len(state["items"]),
        "items_total": item_total,
        "items_with_claims": len(state["claims_completed"]),
    }


def report(path: Path, state: dict[str, Any], started: float, phase: str) -> None:
    payload = {
        "format": "wbs-benchmark-import-result/v1",
        "phase": phase,
        "completed_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "created": {
            "properties": len(state["properties"]),
            "items": len(state["items"]),
            "items_with_claims": len(state["claims_completed"]),
        },
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def import_corpus(args: argparse.Namespace) -> None:
    corpus = args.corpus.resolve()
    manifest = read_json(corpus / "manifest.json")
    entities_path = corpus / "entities.jsonl"
    if not entities_path.exists():
        raise ValueError(f"Corpus has no {entities_path.name}.")
    entities = read_entities(entities_path)
    entities = closed_smoke_subset(entities, args.limit)
    if not entities:
        raise ValueError("The selected corpus has no items to import.")
    property_definitions = manifest.get("properties")
    if not isinstance(property_definitions, list):
        raise ValueError("Corpus manifest has no property catalog.")
    selected_properties = referenced_properties(entities)
    property_definitions = [
        definition
        for definition in property_definitions
        if isinstance(definition, dict)
        and definition.get("source_id") in selected_properties
    ]

    if args.validate_only:
        properties = {
            definition["source_id"]: f"P{index + 1}"
            for index, definition in enumerate(property_definitions)
            if isinstance(definition, dict)
            and isinstance(definition.get("source_id"), str)
        }
        if len(properties) != len(property_definitions):
            raise ValueError("Corpus has an invalid property definition.")
        items = {entity["id"]: f"Q{index + 1}" for index, entity in enumerate(entities)}
        statement_count = sum(
            sum(
                len(values)
                for values in rewrite_claims(entity, {**properties, **items}).values()
            )
            for entity in entities
        )
        print(
            f"Validated {len(items):,} items, {len(properties):,} properties, and {statement_count:,} statements."
        )
        return

    state_path = args.state or corpus / "import-state.json"
    result_path = args.result or corpus / "import-result.json"
    state = load_state(state_path, source_checksum(entities_path))
    started = time.monotonic()

    api = ActionApi(args.api_url, args.insecure)
    api.login(args.username, args.password)
    supported_languages = api.supported_languages()
    print(f"Authenticated to {args.api_url}", file=sys.stderr)
    is_resuming = bool(
        state["properties"] or state["items"] or state["claims_completed"]
    )
    if not is_resuming and not args.allow_existing and api.has_wikibase_entities():
        raise ValueError(
            "The target Wikibase already has entities. Start with an empty instance or pass --allow-existing explicitly."
        )

    for definition in property_definitions:
        source_id = definition.get("source_id")
        datatype = definition.get("datatype")
        if not isinstance(source_id, str) or not isinstance(datatype, str):
            raise ValueError("Corpus has an invalid property definition.")
        if source_id in state["properties"]:
            continue
        recovered = api.find_entity_by_label(
            f"Benchmark source {source_id}", "property"
        )
        if recovered:
            state["properties"][source_id] = recovered
            update_progress(
                state, "properties", len(property_definitions), len(entities)
            )
            save_state(state_path, state)
            print(
                f"Recovered source property {source_id} as {recovered} after an interrupted import.",
                file=sys.stderr,
            )
            continue
        try:
            created = api.edit_entity(
                {
                    "new": "property",
                    "summary": "Wikibase Suite benchmark corpus import",
                    "data": json.dumps(
                        {
                            "datatype": datatype,
                            "labels": {
                                "en": {
                                    "language": "en",
                                    "value": f"Benchmark source {source_id}",
                                }
                            },
                        }
                    ),
                }
            )
        except ApiError as error:
            raise ApiError(
                f"Unable to create source property {source_id} with datatype {datatype}: {error}"
            ) from error
        state["properties"][source_id] = created["id"]
        update_progress(state, "properties", len(property_definitions), len(entities))
        save_state(state_path, state)

    for entity in entities:
        source_id = entity["id"]
        if source_id in state["items"]:
            continue
        try:
            created = api.edit_entity(
                {
                    "new": "item",
                    "data": json.dumps(
                        terms(entity, args.label_prefix, supported_languages)
                    ),
                    "summary": "Wikibase Suite benchmark corpus import",
                }
            )
        except ApiError as error:
            raise ApiError(
                f"Unable to create source item {source_id}: {error}"
            ) from error
        state["items"][source_id] = created["id"]
        update_progress(state, "items", len(property_definitions), len(entities))
        save_state(state_path, state)

    identifiers = {**state["properties"], **state["items"]}
    for entity in entities:
        source_id = entity["id"]
        if source_id in state["claims_completed"]:
            continue
        claims = rewrite_claims(entity, identifiers)
        if claims:
            try:
                api.edit_entity(
                    {
                        "id": mapped_identifier(source_id, identifiers),
                        "data": json.dumps({"claims": claims}),
                        "summary": "Wikibase Suite benchmark corpus import",
                    }
                )
            except ApiError as error:
                raise ApiError(
                    f"Unable to add claims to source item {source_id}: {error}"
                ) from error
        state["claims_completed"].append(source_id)
        update_progress(state, "claims", len(property_definitions), len(entities))
        save_state(state_path, state)
        if len(state["claims_completed"]) % 100 == 0:
            print(
                f"Imported claims for {len(state['claims_completed']):,}/{len(entities):,} items...",
                file=sys.stderr,
            )

    report(result_path, state, started, "completed")
    print(f"Import completed; result written to {result_path}")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument(
        "--api-url", default=os.environ.get("WIKIBASE_BENCHMARK_API_URL")
    )
    parser.add_argument(
        "--username", default=os.environ.get("WIKIBASE_BENCHMARK_USERNAME")
    )
    parser.add_argument(
        "--password", default=os.environ.get("WIKIBASE_BENCHMARK_PASSWORD")
    )
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="Read the Action API password from standard input rather than an argument or environment variable.",
    )
    parser.add_argument("--state", type=Path, help="Resumable import-state JSON path.")
    parser.add_argument("--result", type=Path, help="Import-result JSON path.")
    parser.add_argument(
        "--limit",
        type=int,
        help="Import only the first N corpus items (smoke testing).",
    )
    parser.add_argument(
        "--label-prefix",
        default="",
        help="Prefix imported item labels; useful only when intentionally importing alongside an existing corpus.",
    )
    parser.add_argument(
        "--allow-existing",
        action="store_true",
        help="Allow a new import into a Wikibase that already has entities.",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS certificate verification for an explicitly local development instance.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate all local ID rewrites without connecting to Wikibase.",
    )
    args = parser.parse_args()
    if not args.validate_only:
        for name in ("api_url", "username"):
            if not getattr(args, name):
                parser.error(
                    f"--{name.replace('_', '-')} or WIKIBASE_BENCHMARK_{name.upper()} is required."
                )
        if args.password_stdin:
            args.password = sys.stdin.readline().rstrip("\n")
        if not args.password:
            parser.error(
                "--password, WIKIBASE_BENCHMARK_PASSWORD, or --password-stdin is required."
            )
    return args


if __name__ == "__main__":
    try:
        import_corpus(arguments())
    except (ApiError, ValueError) as error:
        print(f"Benchmark import failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
