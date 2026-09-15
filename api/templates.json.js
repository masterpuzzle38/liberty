"use strict";

const { TEMPLATES, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(TEMPLATES, req, res);
};
