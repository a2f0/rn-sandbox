terraform {
  required_version = ">= 1.16.2, < 2.0"

  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 8.4"
    }
  }

  # The same bucket as the a2f0.net stack, under its own key. The state holds
  # the Sign in with Apple private key.
  backend "s3" {
    bucket       = "resume-terraform"
    key          = "rn-sandbox/auth/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}
