CREATE DATABASE IF NOT EXISTS mwdb_cloud1 CHARACTER SET binary COLLATE binary;
CREATE DATABASE IF NOT EXISTS mwdb_cloud2 CHARACTER SET binary COLLATE binary;

CREATE USER IF NOT EXISTS 'mwu_someuser'@'%' IDENTIFIED BY 'somepassword';
GRANT ALL PRIVILEGES ON mwdb_cloud1.* TO 'mwu_someuser'@'%';
GRANT ALL PRIVILEGES ON mwdb_cloud2.* TO 'mwu_someuser'@'%';
FLUSH PRIVILEGES;
