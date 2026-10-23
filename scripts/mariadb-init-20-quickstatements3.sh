#!/usr/bin/env bash

# QuickStatements 3 is optional; an unset public URL omits its database SQL.
set -euo pipefail

if [[ -z "${QUICKSTATEMENTS3_PUBLIC_URL:-}" ]]; then
    exit 0
fi

cat <<SQL
CREATE DATABASE IF NOT EXISTS quickstatements3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @qs3_grant = IF(
  EXISTS(SELECT 1 FROM mysql.user WHERE User = '$MYSQL_USER' AND Host = '%'),
  'GRANT ALL PRIVILEGES ON quickstatements3.* TO ''$MYSQL_USER''@''%''',
  'DO 0'
);
PREPARE qs3_stmt FROM @qs3_grant;
EXECUTE qs3_stmt;
DEALLOCATE PREPARE qs3_stmt;
SQL
