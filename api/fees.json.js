"use strict";

const { FEES, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(FEES, req, res);
};
