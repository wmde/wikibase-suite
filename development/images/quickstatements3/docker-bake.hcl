variable "IMAGE_NAME" { default = "quickstatements3" }
variable "IMAGE_VERSION" { default = "0.1.0" }
variable "IMAGE_REPOSITORY" { default = "wikibase/quickstatements3" }
variable "TAGS" {
  type    = list(string)
  default = ["latest"]
}
variable "QUICKSTATEMENTS3_COMMIT" { default = "6821180999eba09a89c1dc5a1c62a01ebe5faa06" }

function "image_tags" {
  params = [tags]
  result = [for tag in tags : "${IMAGE_REPOSITORY}:${tag}"]
}

target "quickstatements3" {
  context    = "."
  dockerfile = "Dockerfile"
  args = {
    QUICKSTATEMENTS3_COMMIT = QUICKSTATEMENTS3_COMMIT
  }
  labels = {
    "org.opencontainers.image.source"  = "https://github.com/wmde/wikibase-suite"
    "org.opencontainers.image.version" = IMAGE_VERSION
  }
  tags   = image_tags(TAGS)
  output = [{ type = "docker" }]
}

target "quickstatements3-release" {
  inherits = ["quickstatements3"]
  tags = image_tags([
    IMAGE_VERSION,
    split(".", IMAGE_VERSION)[0],
    join(".", slice(split(".", IMAGE_VERSION), 0, 2)),
    "qs3"
  ])
}

group "default" { targets = ["quickstatements3"] }
