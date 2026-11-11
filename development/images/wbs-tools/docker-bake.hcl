# WBS Tools image manifest. The application package remains package.json.

variable "IMAGE_NAME" { default = "wbs-tools" }
variable "IMAGE_VERSION" { default = "1.0.1" }
variable "IMAGE_REPOSITORY" { default = "wikibase/wbs-tools" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

# Prereleases keep the full version tag but do not move stable aliases.
function "release_tags" {
  params = [stable_aliases]
  result = image_tags(concat(
    [IMAGE_VERSION],
    length(split("-", IMAGE_VERSION)) > 1 ? [] : stable_aliases
  ))
}

target "wbs-tools-base" {
  context    = "../.."
  dockerfile = "images/wbs-tools/Dockerfile"
  args = {
    WBS_TOOLS_VERSION = IMAGE_VERSION
  }
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
}

target "wbs-tools" {
  inherits = ["wbs-tools-base"]
  tags     = image_tags(TAGS)
  output   = [{ type = "docker" }]
}

target "wbs-tools-release" {
  inherits = ["wbs-tools-base"]
  tags = release_tags([
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2))
  ])
}

group "default" { targets = ["wbs-tools"] }
