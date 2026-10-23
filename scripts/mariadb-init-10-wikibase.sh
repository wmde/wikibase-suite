#!/usr/bin/env bash

# Emit idempotent SQL for MariaDB's single --init-file. The first startup of a
# fresh volume runs this before MYSQL_USER exists, then again after it is made.
set -euo pipefail

if [[ -z "${DB_NAME:-}" ]]; then
    echo "DB_NAME is required to provision the Wikibase database." >&2
    exit 1
fi

# Encode the quoted identifier so custom database names cannot alter the SQL.
quoted_name="\`${DB_NAME//\`/\`\`}\`"
quoted_name_hex=$(printf '%s' "$quoted_name" | od -An -tx1 | tr -d ' \n')

cat <<SQL
SET @wikibase_name = CONVERT(0x$quoted_name_hex USING utf8mb4);
SET @wikibase_create = CONCAT('CREATE DATABASE IF NOT EXISTS ', @wikibase_name);
PREPARE wikibase_create_stmt FROM @wikibase_create;
EXECUTE wikibase_create_stmt;
DEALLOCATE PREPARE wikibase_create_stmt;
SET @wikibase_grant = IF(
  EXISTS(SELECT 1 FROM mysql.user WHERE User = '$MYSQL_USER' AND Host = '%'),
  CONCAT('GRANT ALL PRIVILEGES ON ', @wikibase_name, '.* TO ''$MYSQL_USER''@''%'''),
  'DO 0'
);
PREPARE wikibase_stmt FROM @wikibase_grant;
EXECUTE wikibase_stmt;
DEALLOCATE PREPARE wikibase_stmt;
SQL
