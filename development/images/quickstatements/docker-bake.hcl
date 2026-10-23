# QuickStatements image manifest. Runtime build policy is supplied by wbs-dev.

variable "IMAGE_NAME" { default = "quickstatements" }
variable "IMAGE_VERSION" { default = "1.2.3" }
variable "IMAGE_REPOSITORY" { default = "wikibase/quickstatements" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

# Selection, review, and version-impact policy: ./UPDATING.md
variable "QUICKSTATEMENTS_GENERATION" { default = "2" }

variable "QUICKSTATEMENTS" {
  default = {
    name     = "QuickStatements"
    repo     = "https://github.com/magnusmanske/quickstatements.git"
    ref      = "refs/heads/master"
    commit   = "558474da79766d8c7f9d7d0e727194f3cc9ade3a"
  }
}

variable "MAGNUSTOOLS" {
  default = {
    name           = "MagnusTools"
    repo           = "https://codeberg.org/magnusmanske/magnustools.git"
    ref            = "refs/heads/master"
    commit         = "ec79940688576567b12b90373cc091715e3dea06"
    archive        = "https://codeberg.org/magnusmanske/magnustools/archive/{commit}.tar.gz"
    archive_sha256 = "fc80e7fa915126f47d64c3054ede2315f96d16daf4c46f0fe76c0c9dbcefc847"
  }
}

variable "COMPOSER_IMAGE" {
  default = {
    image    = "docker-registry.wikimedia.org/releng/composer-php82"
    tag      = "0.1.1-s2"
    platform = "linux/amd64"
    source   = "https://docker-registry.wikimedia.org/releng/composer-php82/tags/"
  }
}

variable "PHP_IMAGE" {
  default = {
    image  = "php"
    tag    = "8.3.36-apache-bookworm"
    source = "https://hub.docker.com/_/php"
    info   = "https://www.php.net/supported-versions.php"
  }
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

target "quickstatements-base" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    QUICKSTATEMENTS_COMMIT   = QUICKSTATEMENTS.commit
    MAGNUSTOOLS_COMMIT       = MAGNUSTOOLS.commit
    MAGNUSTOOLS_ARCHIVE_SHA  = MAGNUSTOOLS.archive_sha256
    COMPOSER_IMAGE_URL       = "${COMPOSER_IMAGE.image}:${COMPOSER_IMAGE.tag}"
    COMPOSER_IMAGE_PLATFORM  = COMPOSER_IMAGE.platform
    PHP_IMAGE_URL            = "${PHP_IMAGE.image}:${PHP_IMAGE.tag}"
  }
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
}

target "quickstatements" {
  inherits = ["quickstatements-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "quickstatements-release" {
  inherits = ["quickstatements-base"]
  tags = image_tags([
    IMAGE_VERSION,
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2)),
    "qs${QUICKSTATEMENTS_GENERATION}"
  ])
}

group "default" { targets = ["quickstatements"] }
