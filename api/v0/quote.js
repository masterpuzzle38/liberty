"use strict";

const { createVercelHandler } = require("../_lib/settlement-transition");

// Hobby deployments allow 12 functions. /api/v0/validate rewrites here
// (?validate=1) instead of adding api/v0/validate.js.
module.exports = createVercelHandler({ dryRun: true });
