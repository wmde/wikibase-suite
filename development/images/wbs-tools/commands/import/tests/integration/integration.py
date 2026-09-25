#!/usr/bin/env python3
"""Disposable, real MariaDB/Wikibase/OpenSearch test. Uses already-built images."""

import argparse
import http.cookiejar
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import uuid

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("bulk", HERE.parents[1] / "bulk_import.py")
BULK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BULK)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", action="store_true", help="Retain the disposable project for debugging")
    parser.add_argument("--tools-image", help="Exercise packaged wbs import load through this built tools image.")
    parser.add_argument("--entity-count", type=int, default=1,
                        help="Additional generic item entities for the local smoke (default: 1).")
    parser.add_argument("--save-mode", choices=("edit-entity", "entity-store"), default="edit-entity",
                        help="Exercise the requested importer persistence mode.")
    parser.add_argument("--bootstrap", action="store_true",
                        help="Suppress per-entity RecentChanges and Cirrus updates, then rebuild search.")
    parser.add_argument("--without-derived-services", action="store_true",
                        help="Start only Wikibase and MariaDB: no Elasticsearch/Cirrus or QLever/updater.")
    parser.add_argument("--commit-every", type=int, default=1,
                        help="Commit service-native writes and deferred updates every N entities (default: 1).")
    parser.add_argument("--checkpoint-every", type=int, default=1,
                        help="Persist a resume checkpoint every N entities after the initial crash test (default: 1).")
    args = parser.parse_args()
    if args.entity_count < 1:
        parser.error("--entity-count must be positive")
    if args.commit_every < 1 or args.checkpoint_every < 1:
        parser.error("--commit-every and --checkpoint-every must be positive")
    # The import path is deliberately exercised through Compose. Larger local
    # samples can legitimately exceed the generic four-minute command timeout.
    command_timeout = max(240, args.entity_count // 20 + 180)
    workspace = Path(tempfile.mkdtemp(prefix="wbs-bulk-import-test-")).resolve()
    checkpoint = workspace / "state.json"
    if args.tools_image:
        checkpoint = workspace / "import-state/checkpoint.json"
    project = "wbs-bulk-test-" + uuid.uuid4().hex[:10]
    environment = {
        **os.environ,
        "BULK_TEST_WORKSPACE": str(workspace),
    }
    compose_file = "docker-compose.no-derived-services.yml" if args.without_derived_services else "docker-compose.yml"
    compose = ["docker", "compose", "-p", project, "-f", str(HERE / compose_file)]

    def run(*arguments, success=True):
        result = subprocess.run(compose + list(arguments), env=environment, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=command_timeout)
        if success and result.returncode:
            raise RuntimeError(result.stdout)
        if not success and not result.returncode:
            raise AssertionError("Expected command to fail: " + result.stdout)
        return result.stdout

    def maintenance(script, *arguments, **kwargs):
        print(f"Maintenance: {Path(script).name}", flush=True)
        return run("exec", "-T", "wikibase", "php", "/var/www/html/maintenance/run.php", script, *arguments, **kwargs)

    def load(*arguments, checkpoint_every=None, **kwargs):
        checkpoint_every = args.checkpoint_every if checkpoint_every is None else checkpoint_every
        if args.tools_image:
            command = [
                "docker", "run", "--rm",
                "-v", "/var/run/docker.sock:/var/run/docker.sock",
                "-v", f"{workspace}:{workspace}", "-v", f"{HERE}:{HERE}:ro",
                "-e", f"BULK_TEST_WORKSPACE={workspace}",
                "-e", f"BULK_TEST_IMAGE={environment.get('BULK_TEST_IMAGE', 'wikibase/wikibase:8.1.0')}",
                "-e", f"BULK_TEST_SEARCH_IMAGE={environment.get('BULK_TEST_SEARCH_IMAGE', 'wikibase/opensearch:1')}",
                "-e", f"WBS_DISABLE_CIRRUS_UPDATES={environment.get('WBS_DISABLE_CIRRUS_UPDATES', '0')}",
                args.tools_image, "node", "/app/dist/wbs.js", "import", "load",
                "--compose-file", str(HERE / compose_file), "--project-name", project,
                "--bundle", str(workspace / "bundle"), "--state-dir", str(checkpoint.parent),
                "--user", "Importer", "--checkpoint-every", str(checkpoint_every),
                "--commit-every", str(args.commit_every), "--save-mode", args.save_mode,
                *arguments,
            ]
            result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=command_timeout)
            if kwargs.get("success", True) != (result.returncode == 0):
                raise AssertionError(result.stdout)
            return result.stdout
        return maintenance("/opt/wbs-bulk-import/ImportEntities.php",
                           "--bundle", "/import-test/bundle", "--state", "/import-test/state.json",
                           "--user", "Importer", "--checkpoint-every", str(checkpoint_every),
                           "--commit-every", str(args.commit_every),
                           "--save-mode", args.save_mode, *arguments, **kwargs)

    print(f"Disposable project: {project}; workspace: {workspace}", flush=True)
    smoke_result: dict[str, object] = {
        "format": "wbs-bulk-import-local-smoke/v1",
        "fixture_entities": args.entity_count,
        "derived_services": not args.without_derived_services,
    }
    if args.bootstrap:
        environment["WBS_DISABLE_CIRRUS_UPDATES"] = "1"
    try:
        item_ids = list(range(100, 100 + args.entity_count))
        items = [
            {"id": f"Q{identifier}", "type": "item", "labels": {"en": {"language": "en", "value": "Bulk entity" if identifier == 100 else f"Bulk entity {identifier}"}},
             "descriptions": {"en": {"language": "en", "value": "Bulk import fixture"}},
             "claims": {"P31": [{"id": f"Q{identifier}$11111111-2222-3333-4444-{identifier:012d}", "type": "statement", "rank": "normal",
                                  "mainsnak": {"snaktype": "value", "property": "P31", "datatype": "wikibase-item",
                                               "datavalue": {"type": "wikibase-entityid", "value": {
                                                   "id": "Q13442814", "numeric-id": 13442814, "entity-type": "item"}}}}]}}
            for identifier in item_ids
        ]
        entities = [
            {"id": "P31", "type": "property", "datatype": "wikibase-item",
             "labels": {"en": {"language": "en", "value": "instance of"}}},
            {"id": "Q13442814", "type": "item", "labels": {"en": {"language": "en", "value": "fixture type"}}},
            *items,
        ]
        raw = workspace / "raw"
        raw.mkdir()
        (raw / "entities.ndjson").write_text(
            "".join(json.dumps(entity) + "\n" for entity in entities), encoding="utf-8"
        )
        BULK.prepare([raw / "entities.ndjson"], workspace / "bundle")
        print("Starting database, search and Wikibase...", flush=True)
        run("up", "-d", "--wait", "--wait-timeout", "180")
        print("Installing disposable wiki...", flush=True)
        run("exec", "-T", "wikibase", "env", "-u", "MW_CONFIG_FILE", "php",
            "/var/www/html/maintenance/install.php", "--dbserver", "mysql", "--dbname", "bulk_test",
            "--dbuser", "bulk_test", "--dbpass", "bulk-test-only", "--server", "http://bulk.test",
            "--scriptpath", "/w", "--pass", "Bulk-import-test-password-123!", "--confpath", "/tmp",
            "Bulk import test", "Importer")
        maintenance("update", "--quick")
        if not args.without_derived_services:
            maintenance("/var/www/html/extensions/CirrusSearch/maintenance/UpdateSearchIndexConfig.php")

        def recent_change_count():
            output = run("exec", "-T", "mysql", "mariadb", "-ubulk_test", "-pbulk-test-only", "bulk_test", "-N", "-e",
                         "SELECT COUNT(*) FROM recentchanges")
            return int(output.strip())

        initial_recent_changes = recent_change_count()
        load("--validate-only")
        assert not checkpoint.exists(), "Validation created a checkpoint"
        print("Checking partial load and resume...", flush=True)
        load("--limit", "1", *( [ "--bootstrap" ] if args.bootstrap else [] ), checkpoint_every=1)
        initial_checkpoint = checkpoint.read_text()
        assert json.loads(initial_checkpoint)["completed_entities"] == 1
        loaded = load(*( [ "--bootstrap" ] if args.bootstrap else [] ))
        assert '"phase":"revisions-loaded"' in loaded, loaded
        state = json.loads(checkpoint.read_text())
        assert state["completed_entities"] == args.entity_count + 2
        checkpoint_entity = state["last_id"]

        def revisions():
            output = run("exec", "-T", "mysql", "mariadb", "-ubulk_test", "-pbulk-test-only", "bulk_test", "-N", "-e",
                         "SELECT COUNT(*) FROM revision JOIN page ON rev_page=page_id "
                         "WHERE page_content_model IN ('wikibase-item', 'wikibase-property')")
            return int(output.strip())

        expected_entities = args.entity_count + 2  # P31 plus one fixture value item.
        assert revisions() == expected_entities, "Import should create one revision per entity"
        if args.bootstrap:
            assert recent_change_count() == initial_recent_changes, (
                "Silent bootstrap revisions must not add RecentChanges"
            )
        event = json.loads([line for line in loaded.splitlines() if line.startswith("{")][-1])
        import_result = {
            "fixture_entities": args.entity_count,
            "save_mode": event["save_mode"],
            "bootstrap": event["bootstrap"],
            "commit_every": event["commit_every"],
            "created_this_run": event["created_this_run"],
            "created_per_second_including_setup": event["created_per_second"],
            "created_per_second_save_loop": event["entity_save_loop_created_per_second"],
            "setup_seconds": event["setup_seconds"],
            "save_attempt_seconds": event["save_attempt_seconds"],
            "commit_and_deferred_seconds": event["commit_and_deferred_seconds"],
            "php_peak_bytes": event["php_peak_bytes"],
        }
        smoke_result["import"] = import_result
        print("SMOKE_IMPORT: " + json.dumps(import_result), flush=True)
        # Model a crash after database commits but before the next checkpoint.
        checkpoint.write_text(initial_checkpoint)
        recovered = load(*( [ "--bootstrap" ] if args.bootstrap else [] ))
        assert f'"recovered_this_run":{args.entity_count + 1}' in recovered, recovered
        assert revisions() == expected_entities, "Recovery must not duplicate revisions"
        load(*( [ "--bootstrap" ] if args.bootstrap else [] ))
        assert revisions() == expected_entities, "Completed rerun must be a no-op"
        saved_checkpoint = checkpoint.read_text()
        checkpoint.unlink()
        assert "requires a wiki without entities" in load(*( [ "--bootstrap" ] if args.bootstrap else [] ), success=False)
        checkpoint.write_text(saved_checkpoint)
        entities_path = workspace / "bundle/entities.ndjson"
        original = entities_path.read_bytes()
        entities_path.write_bytes(original + b"\n")
        assert "checksum mismatch" in load(*( [ "--bootstrap" ] if args.bootstrap else [] ), success=False)
        entities_path.write_bytes(original)

        if args.bootstrap and not args.without_derived_services:
            # Re-enable normal updates before the one deliberate bulk index build.
            environment["WBS_DISABLE_CIRRUS_UPDATES"] = "0"
            run("up", "-d", "--force-recreate", "wikibase")
            maintenance("/var/www/html/extensions/CirrusSearch/maintenance/ForceSearchIndex.php", "--skipLinks", "--indexOnSkip")

        address = run("port", "wikibase", "80").strip().splitlines()[-1]
        endpoint = f"http://{address}/w/api.php"
        cookies = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))

        def api(**parameters):
            data = urllib.parse.urlencode({"format": "json", **parameters}).encode()
            with opener.open(endpoint, data=data, timeout=30) as response:
                result = json.load(response)
            if "error" in result:
                raise RuntimeError(result)
            return result

        print("Checking API reads, search, normal edits and new ID allocation...", flush=True)
        entity = api(action="wbgetentities", ids="Q100")["entities"]["Q100"]
        assert entity["claims"]["P31"][0]["mainsnak"]["datavalue"]["value"]["id"] == "Q13442814"
        login_token = api(action="query", meta="tokens", type="login")["query"]["tokens"]["logintoken"]
        login = api(action="login", lgname="Importer", lgpassword="Bulk-import-test-password-123!", lgtoken=login_token)
        assert login["login"]["result"] == "Success", login
        token = api(action="query", meta="tokens")["query"]["tokens"]["csrftoken"]
        new_item = api(action="wbeditentity", new="item", token=token, data=json.dumps({"labels": {"en": {"language": "en", "value": "After import"}}}))
        assert int(new_item["entity"]["id"][1:]) > 100, new_item
        new_property = api(action="wbeditentity", new="property", token=token, data=json.dumps({"datatype": "string", "labels": {"en": {"language": "en", "value": "After import property"}}}))
        assert int(new_property["entity"]["id"][1:]) > 31, new_property
        api(action="wbeditentity", id=checkpoint_entity, token=token,
            data=json.dumps({"labels": {"en": {"language": "en", "value": "Changed checkpoint entity"}}}))
        assert "checkpoint revision changed" in load(*( [ "--bootstrap" ] if args.bootstrap else [] ), success=False)
        api(action="wbeditentity", id="Q100", token=token,
            data=json.dumps({"labels": {"en": {"language": "en", "value": "Edited bulk entity"}},
                             "descriptions": {"en": {"language": "en", "value": "Edited after import"}}}))
        if not args.without_derived_services:
            indexing_started = time.monotonic()
            # Import creates deferred/indexing work per entity; a fixed 1,000-job
            # drain is not a settled-state definition once the smoke is larger.
            maintenance("runJobs", "--maxjobs", str(max(1_000, args.entity_count * 5)), "--maxtime", "180")
            deadline = time.monotonic() + 60
            while True:
                found = api(action="wbsearchentities", search="Edited bulk entity", language="en")
                if any(row["id"] == "Q100" for row in found["search"]):
                    break
                if time.monotonic() > deadline:
                    raise AssertionError("Imported entity did not become searchable: " + json.dumps(found))
                maintenance("runJobs", "--maxjobs", "1000", "--maxtime", "60")
                time.sleep(1)
            indexing_result = {
                "fixture_entities": args.entity_count,
                "seconds_until_post_import_edit_searchable": time.monotonic() - indexing_started,
            }
            smoke_result["indexing"] = indexing_result
            print("SMOKE_INDEXING: " + json.dumps(indexing_result), flush=True)
        with opener.open(f"http://{address}/wiki/Special:EntityData/Q100.ttl", timeout=30) as response:
            rdf = response.read().decode()
        assert "Q100" in rdf and "Q13442814" in rdf and "P31" in rdf, rdf[:2000]
        smoke_result["status"] = "passed"
        (workspace / "smoke-result.json").write_text(json.dumps(smoke_result, indent=2) + "\n", encoding="utf-8")
        checks = "preserved IDs/links, one revision per entity, checkpoint resume, crash-window recovery, checksum/existing-wiki rejection, normal API edits, allocator reservation and RDF export"
        if not args.without_derived_services:
            checks += ", and OpenSearch search after editing"
        print("PASS: " + checks + ".", flush=True)
    finally:
        if args.keep:
            print(f"Retained {project} and {workspace}; use the Compose file and BULK_TEST_WORKSPACE to inspect.")
        else:
            # Only this test's uniquely named Compose project and its disposable volumes.
            run("down", "--volumes", "--remove-orphans")
            print(f"Removed disposable Docker project {project}; logs/checkpoints retained in {workspace}.")


if __name__ == "__main__":
    main()
