output "project_id" {
  value = google_project.default.project_id
}

# The Firebase web config is public: it identifies the project to clients.
output "firebase_config" {
  value = {
    apiKey     = data.google_firebase_web_app_config.default.api_key
    authDomain = data.google_firebase_web_app_config.default.auth_domain
    projectId  = google_project.default.project_id
    appId      = google_firebase_web_app.default.app_id
  }
}

output "apple_app_id" {
  value = google_firebase_apple_app.default.app_id
}

output "android_app_id" {
  value = google_firebase_android_app.default.app_id
}
