#!/usr/bin/env bash

# Emit idempotent SQL for MariaDB's --init-file on every start. A fresh volume
# needs WBS_DB_PASSWORD to create the application user; an existing volume can
# omit it because the password is removed from Suite's .env after installation.
set -euo pipefail

if [[ ! "${WBS_DB_USER:-}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,79}$ ]]; then
    echo "A valid WBS_DB_USER is required to provision Suite databases." >&2
    exit 1
fi

if [[ ! -d /var/lib/mysql/mysql && -z "${WBS_DB_PASSWORD:-}" ]]; then
    echo "WBS_DB_PASSWORD is required to provision a fresh MariaDB volume." >&2
    exit 1
fi

wikibase_db_name=${WIKIBASE_DB_NAME:-my_wiki}
quickstatements3_db_name=${QUICKSTATEMENTS3_DB_NAME:-quickstatements3}

# Provision the Suite database user and Wikibase database.
quoted_wikibase_name="\`${wikibase_db_name//\`/\`\`}\`"
wikibase_name_hex=$(printf '%s' "$quoted_wikibase_name" | od -An -tx1 | tr -d ' \n')

cat <<SQL
SET @wikibase_name = CONVERT(0x$wikibase_name_hex USING utf8mb4);
SET @wikibase_create = CONCAT('CREATE DATABASE IF NOT EXISTS ', @wikibase_name);
PREPARE wikibase_create_stmt FROM @wikibase_create;
EXECUTE wikibase_create_stmt;
DEALLOCATE PREPARE wikibase_create_stmt;
SQL

if [[ -n "${WBS_DB_PASSWORD:-}" ]]; then
    password_hex=$(printf '%s' "$WBS_DB_PASSWORD" | od -An -tx1 | tr -d ' \n')
    cat <<SQL
SET @wbs_password = CONVERT(0x$password_hex USING utf8mb4);
SET @wbs_create_user = CONCAT('CREATE USER IF NOT EXISTS ''$WBS_DB_USER''@''%'' IDENTIFIED BY ', QUOTE(@wbs_password));
PREPARE wbs_create_user_stmt FROM @wbs_create_user;
EXECUTE wbs_create_user_stmt;
DEALLOCATE PREPARE wbs_create_user_stmt;
SQL
fi

cat <<SQL
SET @wikibase_grant = IF(
  EXISTS(SELECT 1 FROM mysql.user WHERE User = '$WBS_DB_USER' AND Host = '%'),
  CONCAT('GRANT ALL PRIVILEGES ON ', @wikibase_name, '.* TO ''$WBS_DB_USER''@''%'''),
  'DO 0'
);
PREPARE wikibase_stmt FROM @wikibase_grant;
EXECUTE wikibase_stmt;
DEALLOCATE PREPARE wikibase_stmt;
SQL

# Provision the QuickStatements 3 database when the service is configured.
if [[ -n "${QUICKSTATEMENTS3_PUBLIC_URL:-}" ]]; then
    quoted_qs3_name="\`${quickstatements3_db_name//\`/\`\`}\`"
    qs3_name_hex=$(printf '%s' "$quoted_qs3_name" | od -An -tx1 | tr -d ' \n')
    cat <<SQL
SET @qs3_name = CONVERT(0x$qs3_name_hex USING utf8mb4);
SET @qs3_create = CONCAT('CREATE DATABASE IF NOT EXISTS ', @qs3_name, ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
PREPARE qs3_create_stmt FROM @qs3_create;
EXECUTE qs3_create_stmt;
DEALLOCATE PREPARE qs3_create_stmt;
SET @qs3_grant = IF(
  EXISTS(SELECT 1 FROM mysql.user WHERE User = '$WBS_DB_USER' AND Host = '%'),
  CONCAT('GRANT ALL PRIVILEGES ON ', @qs3_name, '.* TO ''$WBS_DB_USER''@''%'''),
  'DO 0'
);
PREPARE qs3_stmt FROM @qs3_grant;
EXECUTE qs3_stmt;
DEALLOCATE PREPARE qs3_stmt;
SQL
fi
