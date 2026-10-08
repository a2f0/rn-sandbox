variable "project_id" {
  description = "Google Cloud project for Firebase Authentication. Terraform creates it."
  type        = string
  default     = "a2f0-rn-sandbox"
}

variable "billing_account" {
  description = "Billing account ID (XXXXXX-XXXXXX-XXXXXX). Identity Platform needs one; its free tier covers the sandbox."
  type        = string
}

variable "org_id" {
  description = "Organization to create the project in, or null for none."
  type        = string
  default     = null
}

variable "app_id" {
  description = "iOS bundle ID and Android package name."
  type        = string
  default     = "net.a2f0.sandbox.rn"
}

variable "apple_team_id" {
  description = "Apple Developer team that signs the iOS app."
  type        = string
  default     = "H4QLD7XWGS"
}

# Google Sign-In on Android only works in builds signed with a registered key.
variable "android_sha1_hashes" {
  description = "SHA-1 fingerprints of the keys that sign the Android app."
  type        = list(string)
  default = [
    # Google Play app signing key: Play re-signs the uploaded App Bundle.
    "ab2ab3d4bb1d224f95c21572e4aba466fc0752e1",
    # Upload key (.secrets/rn-sandbox-upload.keystore).
    "acdce782cb90fefd9d3085e78f7927d5ca010b95",
    # This Mac's ~/.android/debug.keystore, which signs debug and local
    # release builds. Each machine's differs.
    "be4954f2e538f3c805e630b55ab787ef3090a8ca",
  ]
}

variable "android_sha256_hashes" {
  description = "SHA-256 fingerprints of the same keys."
  type        = list(string)
  default = [
    "2c5d280d3a2c5a5400faf5999dc2efa4deb7c4fe257887f6ac36221ac325725e",
    "b49c79a27e11bfcc21d177849607ba893b0dca5c2599b1fe9395f812f90af852",
    "156d44097107ee14cd6c39e2dbde83047ab3bf3517a8fe5ad9b5fec0359889e8",
  ]
}

variable "web_domains" {
  description = "Domains the web build signs in from, besides localhost and Firebase's own."
  type        = list(string)
  default     = ["rn-sandbox.a2f0.net"]
}
