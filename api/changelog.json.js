"use strict";

const { CHANGELOG, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(CHANGELOG, req, res);
};
