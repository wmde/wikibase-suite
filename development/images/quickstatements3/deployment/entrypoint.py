import json
import os
import subprocess
import sys
import time


config_file = os.environ.get("QS3_CONFIG_FILE", "/quickstatements3/data/runtime.json")
try:
    with open(config_file, encoding="utf-8") as config_stream:
        config = json.load(config_stream)
except (OSError, json.JSONDecodeError) as error:
    sys.exit(f"QuickStatements 3 runtime configuration is unavailable: {error}")

for name, value in config.items():
    os.environ.setdefault(name, str(value))

required = ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "DJANGO_SECRET_KEY", "OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET")
missing = [name for name in required if not os.environ.get(name)]
if missing:
    sys.exit(f"QuickStatements 3 runtime configuration is missing: {', '.join(missing)}")

for attempt in range(30):
    result = subprocess.run(
        ["python", "/app/src/manage.py", "shell", "-c", "from django.db import connection; connection.ensure_connection()"],
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
    ["/usr/bin/supervisord", "--nodaemon", "--configuration", "/etc/supervisor/supervisord.conf"],
)
