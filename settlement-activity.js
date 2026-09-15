(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.LibertySettlementActivity = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "liberty.agent-settlement.activity.v0";
  const MAX_EVENTS = 80;
  const DETAIL_MAX = 160;
  const JOB_ID_PATTERN = /^as_[0-9a-f]{10}$/;
  const ACTIONS = [
    "create",
    "fund",
    "submit",
    "release",
    "dispute",
    "simulate",
    "verify",
    "import",
    "export",
    "reset",
    "clear",
  ];

  function fail(error, message) {
    return { ok: false, error, message };
  }

  function asText(value, max) {
    if (value == null) return "";
    const text = String(value).trim();
    if (!text) return "";
    return text.length > max ? text.slice(0, max) : text;
  }

  function parseJson(raw) {
    if (raw == null || raw === "") return { ok: true, value: [] };
    if (Array.isArray(raw)) return { ok: true, value: raw };
    if (raw && typeof raw === "object") {
      if (Array.isArray(raw.events)) return { ok: true, value: raw.events };
      return { ok: true, value: [] };
    }
    if (typeof raw !== "string") return { ok: true, value: [] };
    const text = raw.trim();
    if (!text) return { ok: true, value: [] };
    try {
      return parseJson(JSON.parse(text));
    } catch {
      return { ok: true, value: [] };
    }
  }

  function readEvent(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const action = typeof raw.action === "string" ? raw.action.trim() : "";
    if (!ACTIONS.includes(action)) return null;
    const at = typeof raw.at === "string" && raw.at.trim() ? raw.at.trim() : "";
    if (!at) return null;
    const event = {
      at,
      action,
      money: false,
      mode: "demo",
    };
    const jobId = asText(raw.job_id || raw.jobId, 32);
    if (jobId && JOB_ID_PATTERN.test(jobId)) event.job_id = jobId;
    const clientRef = asText(raw.client_ref || raw.clientRef, 128);
    if (clientRef) event.client_ref = clientRef;
    const detail = asText(raw.detail, DETAIL_MAX);
    if (detail) event.detail = detail;
    return event;
  }

  function readEvents(raw) {
    const parsed = parseJson(raw);
    const list = [];
    if (!parsed.ok || !Array.isArray(parsed.value)) return list;
    for (const item of parsed.value) {
      const event = readEvent(item);
      if (event) list.push(event);
    }
    return list.slice(0, MAX_EVENTS);
  }

  function buildDetail(input) {
    if (!input || typeof input !== "object") return "";
    if (typeof input.detail === "string" && input.detail.trim()) {
      return asText(input.detail, DETAIL_MAX);
    }
    const bits = [];
    const jobId = asText(input.job_id || input.jobId, 32);
    const clientRef = asText(input.client_ref || input.clientRef, 128);
    if (jobId) bits.push(jobId);
    if (clientRef) bits.push(clientRef);
    return bits.join(" · ");
  }

  function appendEvent(events, input, options) {
    const src = input && typeof input === "object" ? input : {};
    const action = typeof src.action === "string" ? src.action.trim() : "";
    if (!ACTIONS.includes(action)) {
      return fail("invalid_action", "Activity action is not recognized.");
    }
    const at = typeof src.at === "string" && src.at.trim()
      ? src.at.trim()
      : new Date().toISOString();
    const next = readEvent({
      at,
      action,
      job_id: src.job_id || src.jobId,
      client_ref: src.client_ref || src.clientRef,
      detail: buildDetail(src),
    });
    if (!next) return fail("invalid_event", "Activity event is not valid.");
    const max = Number.isInteger(options && options.max) && options.max > 0
      ? options.max
      : MAX_EVENTS;
    const list = readEvents(events);
    list.unshift(next);
    if (list.length > max) list.length = max;
    return {
      ok: true,
      event: next,
      events: list,
      money: false,
      mode: "demo",
    };
  }

  function clearEvents() {
    return {
      ok: true,
      events: [],
      money: false,
      mode: "demo",
    };
  }

  function writeEvents(events) {
    return JSON.stringify(readEvents(events));
  }

  function confirmClearMessage() {
    return {
      ok: true,
      message: [
        "Clear this browser’s activity log?",
        "Jobs, wallets, receipts, and the demo API key stay.",
        "Only the activity list is removed.",
        "Liberty does not receive anything. Demo only.",
      ].join(" "),
    };
  }

  return {
    ACTIONS,
    MAX_EVENTS,
    STORAGE_KEY,
    appendEvent,
    clearEvents,
    confirmClearMessage,
    readEvents,
    writeEvents,
  };
});
