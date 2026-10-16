terraform {
  required_version = ">= 1.16.2, < 2.0"

  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 8.4"
    }
  }

  # State lives in this project's own Cloudflare R2 bucket (S3-compatible).
  # scripts/auth/provision.mjs maps the prod tier's TF_STATE_* credentials to
  # the AWS variables the backend reads.
  backend "s3" {
    bucket = "rn-sandbox-terraform-state"
    key    = "auth/terraform.tfstate"
    region = "auto"
    endpoints = {
      s3 = "https://0be508e6c4caa573595c5f94e11900e4.r2.cloudflarestorage.com"
    }
    use_lockfile                = true
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}
