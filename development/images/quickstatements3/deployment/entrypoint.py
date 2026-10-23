import json
import os
import subprocess
import sys
import time
from urllib.parse import urlsplit

config_file = os.environ.get("QS3_CONFIG_FILE", "/quickstatements3/data/runtime.json")
if os.environ.get("QS3_CONFIG_FILE") or os.path.isfile(config_file):
    try:
        with open(config_file, encoding="utf-8") as config_stream:
            config = json.load(config_stream)
    except (OSError, json.JSONDecodeError) as error:
        sys.exit(f"QuickStatements 3 runtime configuration is unavailable: {error}")
    if not isinstance(config, dict):
        sys.exit("QuickStatements 3 runtime configuration must be a JSON object.")
    if "DB_PASSWORD" in config and "DB_PASS" not in config:
        config["DB_PASS"] = config["DB_PASSWORD"]
    for name, value in config.items():
        os.environ.setdefault(name, str(value))

quickstatements_public_url = os.environ.get("QUICKSTATEMENTS_PUBLIC_URL")
if quickstatements_public_url:
    parsed_url = urlsplit(quickstatements_public_url)
    if parsed_url.scheme not in ("http", "https") or not parsed_url.hostname:
        sys.exit("QuickStatements 3 requires a valid QUICKSTATEMENTS_PUBLIC_URL.")
    os.environ.setdefault("QS3_URL_PREFIX", parsed_url.path.rstrip("/"))
    os.environ.setdefault(
        "DJANGO_ALLOWED_HOSTS", f"{parsed_url.hostname},localhost,127.0.0.1"
    )
    os.environ.setdefault(
        "CSRF_TRUSTED_ORIGINS", f"{parsed_url.scheme}://{parsed_url.netloc}"
    )

wikibase_public_url = os.environ.get("WIKIBASE_PUBLIC_URL")
if wikibase_public_url:
    os.environ.setdefault("OAUTH_AUTHORIZATION_SERVER", wikibase_public_url.rstrip("/"))
    os.environ.setdefault("DEFAULT_WIKIBASE_URL", wikibase_public_url.rstrip("/"))

if os.environ.get("DB_SERVER"):
    host, separator, port = os.environ["DB_SERVER"].rpartition(":")
    if not separator:
        host, port = os.environ["DB_SERVER"], "3306"
    if not host or not port.isdecimal() or not 1 <= int(port) <= 65535:
        sys.exit(
            "QuickStatements 3 DB_SERVER must be a hostname with an optional port."
        )
    os.environ["DB_HOST"] = host
    os.environ["DB_PORT"] = port
if os.environ.get("DB_PASS"):
    os.environ["DB_PASSWORD"] = os.environ["DB_PASS"]

required = (
    "DB_HOST",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "DJANGO_SECRET_KEY",
    "OAUTH_CLIENT_ID",
    "OAUTH_CLIENT_SECRET",
)
missing = [name for name in required if not os.environ.get(name)]
if missing:
    sys.exit(
        f"QuickStatements 3 runtime configuration is missing: {', '.join(missing)}"
    )

for attempt in range(30):
    result = subprocess.run(
        [
            "python",
            "/app/src/manage.py",
            "shell",
            "-c",
            "from django.db import connection; connection.ensure_connection()",
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if result.returncode == 0:
        break
    if attempt == 29:
        sys.exit("QuickStatements 3 could not connect to MariaDB after 30 attempts.")
    time.sleep(2)

for command in (
    ["python", "/app/src/manage.py", "translate"],
    ["python", "/app/src/manage.py", "migrate", "--noinput"],
    ["python", "/app/src/manage.py", "collectstatic", "--noinput"],
):
    subprocess.run(command, check=True)

os.execv(
    "/usr/bin/supervisord",
    [
        "/usr/bin/supervisord",
        "--nodaemon",
        "--configuration",
        "/etc/supervisor/supervisord.conf",
    ],
)
