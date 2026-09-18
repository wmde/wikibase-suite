# QLever Updater image. Runtime build policy is supplied by wbs-dev.

variable "IMAGE_NAME" { default = "wdqs-qlever-updater" }
variable "IMAGE_VERSION" { default = "0.1.0" }
variable "IMAGE_REPOSITORY" { default = "wikibase/wdqs-qlever-updater" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

# Foundation WDQS Common is the canonical home of the Munger and shared RDF
# model used by the QLever streaming producer. Consume its published release;
# the source tag and immutable commit document the artifact provenance.
variable "WDQS_COMMON" {
  default = {
    repo   = "https://gitlab.wikimedia.org/repos/wikidata-platform/wdqs/wdqs-common.git"
    ref    = "refs/tags/v0.1.0"
    commit = "0366dc8eb12c251787ae141850ab05b136e04dff"
    version = "0.1.0"
  }
}

variable "BUILD_IMAGE" {
  default = {
    image  = "maven"
    tag    = "3.9-eclipse-temurin-25"
    source = "https://hub.docker.com/_/maven"
  }
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

target "wdqs-qlever-updater-base" {
  context = "."
  args = {
    BUILD_IMAGE = "${BUILD_IMAGE.image}:${BUILD_IMAGE.tag}"
  }
  labels = {
    "org.opencontainers.image.source" = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
    "org.opencontainers.image.revision" = WDQS_COMMON.commit
  }
}

target "wdqs-qlever-updater" {
  inherits = ["wdqs-qlever-updater-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "wdqs-qlever-updater-release" {
  inherits = ["wdqs-qlever-updater-base"]
  tags = image_tags([
    IMAGE_VERSION,
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2))
  ])
}

group "default" { targets = ["wdqs-qlever-updater"] }
