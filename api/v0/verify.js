"use strict";

const { createVercelHandler } = require("../_lib/settlement-transition");

module.exports = createVercelHandler({ verify: true });
