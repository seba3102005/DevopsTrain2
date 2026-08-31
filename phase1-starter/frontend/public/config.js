// Local dev defaults. Keep API URLs wired through this file rather than
// hardcoding them elsewhere in the app -- when deploying (e.g. to
// OpenShift), edit this file's values after the build instead of
// rebuilding the whole frontend image.
window.__ENV__ = {
  AUTH_BASE_URL: "http://localhost:8082",
  CATALOG_BASE_URL: "http://localhost:8081",
  BOOKING_BASE_URL: "http://localhost:8083",
  AI_BASE_URL: "http://localhost:8084",
  ANALYTICS_BASE_URL: "http://localhost:8085",
};
