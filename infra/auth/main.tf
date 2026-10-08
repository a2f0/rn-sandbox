# Firebase Authentication with Identity Platform for the app on iOS, Android,
# and the web. scripts/auth/provision.ts applies this, then turns on the Google
# and Apple providers, which Terraform can't fully configure, and writes the
# app's config. See the README.

# Firebase APIs bill quota to the project, so requests name it. Creating the
# project, and enabling the APIs in it, can't.
provider "google-beta" {
  user_project_override = true
}

provider "google-beta" {
  alias                 = "no_user_project_override"
  user_project_override = false
}

resource "google_project" "default" {
  provider = google-beta.no_user_project_override

  project_id      = var.project_id
  name            = "RN Sandbox"
  org_id          = var.org_id
  billing_account = var.billing_account

  # Shows the project in the Firebase console.
  labels = {
    firebase = "enabled"
  }
}

resource "google_project_service" "default" {
  provider = google-beta.no_user_project_override
  project  = google_project.default.project_id
  for_each = toset([
    "cloudbilling.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com",
    "serviceusage.googleapis.com",
  ])
  service = each.key

  # Keeps the APIs on if this stack is destroyed.
  disable_on_destroy = false
}

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = google_project.default.project_id

  depends_on = [google_project_service.default]
}

# Upgrades Firebase Authentication to Identity Platform.
resource "google_identity_platform_config" "default" {
  provider = google-beta
  project  = google_firebase_project.default.project

  authorized_domains = concat(
    [
      "localhost",
      "${google_project.default.project_id}.firebaseapp.com",
      "${google_project.default.project_id}.web.app",
    ],
    var.web_domains,
  )
}

resource "google_firebase_apple_app" "default" {
  provider     = google-beta
  project      = google_firebase_project.default.project
  display_name = "RN Sandbox iOS"
  bundle_id    = var.app_id
  team_id      = var.apple_team_id
}

# Firebase creates the Android OAuth client for Google Sign-In from these
# fingerprints.
resource "google_firebase_android_app" "default" {
  provider      = google-beta
  project       = google_firebase_project.default.project
  display_name  = "RN Sandbox Android"
  package_name  = var.app_id
  sha1_hashes   = var.android_sha1_hashes
  sha256_hashes = var.android_sha256_hashes
}

resource "google_firebase_web_app" "default" {
  provider     = google-beta
  project      = google_firebase_project.default.project
  display_name = "RN Sandbox web"
}

data "google_firebase_web_app_config" "default" {
  provider   = google-beta
  project    = google_firebase_project.default.project
  web_app_id = google_firebase_web_app.default.app_id
}
