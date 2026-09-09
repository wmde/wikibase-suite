# QLever Updater image. Runtime build policy is supplied by wbs-dev.

variable "IMAGE_NAME" { default = "qlever-updater" }
variable "IMAGE_VERSION" { default = "0.1.0" }
variable "IMAGE_REPOSITORY" { default = "wikibase/qlever-updater" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

target "qlever-updater-base" {
  context = "."
  labels = {
    "org.opencontainers.image.source" = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
}

target "qlever-updater" {
  inherits = ["qlever-updater-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "qlever-updater-release" {
  inherits = ["qlever-updater-base"]
  tags = image_tags([
    IMAGE_VERSION,
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2))
  ])
}

group "default" { targets = ["qlever-updater"] }
