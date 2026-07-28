// Paths under the authenticated router that should skip auth.
// (empty — /health and /api-docs are mounted outside the /queue router)
const ignoredRoutes = [];
module.exports = ignoredRoutes;
