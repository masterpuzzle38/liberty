(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.LibertyHoldExpiry = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MODES = ["none", "ttl", "utc"];
  const UNITS = {
    seconds: 1,
    minutes: 60,
  };
  const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  const HINT = "Optional. Send a TTL or an absolute UTC time — not both. After expiry, release fails; dispute still refunds. Demo only — not real money.";

  function fail(error, message, extra) {
    return {
      ok: false,
      error,
      message,
      money: false,
      mode: "demo",
      ...(extra || {}),
    };
  }

  function ok(fields) {
    return {
      ok: true,
      fields: fields || {},
      money: false,
      mode: "demo",
    };
  }

  function readInteger(value, field) {
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 1) {
        return fail("invalid_field", `${field} must be an integer >= 1.`, { field });
      }
      return { ok: true, value };
    }
    if (typeof value !== "string") {
      return fail("invalid_field", `${field} must be an integer >= 1.`, { field });
    }
    const text = value.trim();
    if (!text) {
      return fail("invalid_field", `${field} must be an integer >= 1.`, { field });
    }
    if (!/^\d+$/.test(text)) {
      return fail("invalid_field", `${field} must be an integer >= 1.`, { field });
    }
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1) {
      return fail("invalid_field", `${field} must be an integer >= 1.`, { field });
    }
    return { ok: true, value: n };
  }

  function readExpiryFields(input) {
    const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const modeRaw = typeof src.mode === "string" ? src.mode.trim().toLowerCase() : "";
    const mode = !modeRaw || modeRaw === "none" ? "none" : modeRaw;

    if (mode === "none") return ok({});

    if (mode === "ttl" || mode === "ttl_seconds" || mode === "ttlseconds") {
      const unitName = typeof src.unit === "string" && src.unit.trim()
        ? src.unit.trim().toLowerCase()
        : "seconds";
      const multiplier = UNITS[unitName];
      if (!multiplier) {
        return fail("invalid_field", "TTL unit must be seconds or minutes.", { field: "ttl_seconds" });
      }
      const ttl = readInteger(src.ttl ?? src.ttl_seconds ?? src.ttlSeconds, "ttl_seconds");
      if (!ttl.ok) return ttl;
      return ok({ ttl_seconds: ttl.value * multiplier });
    }

    if (mode === "utc" || mode === "expires_at" || mode === "expiresat") {
      const raw = src.expires_at ?? src.expiresAt ?? "";
      if (typeof raw !== "string") {
        return fail("invalid_field", "expires_at must be an ISO-8601 UTC datetime.", { field: "expires_at" });
      }
      const text = raw.trim();
      if (!text || !ISO_DATE_TIME.test(text)) {
        return fail("invalid_field", "expires_at must be an ISO-8601 UTC datetime.", { field: "expires_at" });
      }
      const ms = Date.parse(text);
      if (!Number.isFinite(ms)) {
        return fail("invalid_field", "expires_at must be an ISO-8601 UTC datetime.", { field: "expires_at" });
      }
      const nowRaw = src.now;
      const nowMs = typeof nowRaw === "string" || typeof nowRaw === "number"
        ? Date.parse(String(nowRaw))
        : Date.now();
      if (Number.isFinite(nowMs) && ms <= nowMs) {
        return fail("invalid_field", "expires_at must be in the future.", { field: "expires_at" });
      }
      return ok({ expires_at: new Date(ms).toISOString() });
    }

    return fail("invalid_field", "Hold expiry mode must be none, TTL, or absolute UTC.", { field: "mode" });
  }

  function readFromRoot(root, prefix) {
    if (!root || typeof root.querySelector !== "function") {
      return fail("invalid_field", "Hold expiry form is missing.");
    }
    const name = `${prefix}-mode`;
    const checked = root.querySelector(`input[name="${name}"]:checked`);
    const mode = checked && typeof checked.value === "string" ? checked.value : "none";
    const ttlEl = root.querySelector(`#${prefix}-ttl`);
    const unitEl = root.querySelector(`#${prefix}-unit`);
    const atEl = root.querySelector(`#${prefix}-at`);
    return readExpiryFields({
      mode,
      ttl: ttlEl ? ttlEl.value : "",
      unit: unitEl ? unitEl.value : "seconds",
      expires_at: atEl ? atEl.value : "",
    });
  }

  function formHtml(prefix) {
    const id = String(prefix || "hold").replace(/[^a-z0-9-]/gi, "") || "hold";
    return `
      <fieldset class="hold-expiry" data-hold-expiry="${id}">
        <legend>Hold expiry (optional)</legend>
        <p class="hint">${HINT}</p>
        <label class="choice">
          <input type="radio" name="${id}-mode" value="none" checked />
          No expiry
        </label>
        <label class="choice">
          <input type="radio" name="${id}-mode" value="ttl" />
          TTL
        </label>
        <div class="row-form hold-expiry-ttl">
          <label class="field grow">
            <span>TTL</span>
            <input id="${id}-ttl" name="${id}-ttl" type="number" inputmode="numeric" min="1" step="1" placeholder="60" />
          </label>
          <label class="field">
            <span>Unit</span>
            <select id="${id}-unit" name="${id}-unit">
              <option value="seconds" selected>seconds</option>
              <option value="minutes">minutes</option>
            </select>
          </label>
        </div>
        <label class="choice">
          <input type="radio" name="${id}-mode" value="utc" />
          Absolute UTC
        </label>
        <label class="field">
          <span>expires_at (ISO-8601 UTC)</span>
          <input id="${id}-at" name="${id}-at" type="text" autocomplete="off" spellcheck="false" placeholder="2026-09-16T00:00:00Z" />
        </label>
      </fieldset>
    `;
  }

  function bindAutoMode(root, prefix) {
    if (!root || typeof root.addEventListener !== "function") return;
    const id = String(prefix || "hold");
    root.addEventListener("focusin", (event) => {
      const targetId = event.target && event.target.id;
      let mode = "";
      if (targetId === `${id}-ttl` || targetId === `${id}-unit`) mode = "ttl";
      if (targetId === `${id}-at`) mode = "utc";
      if (!mode) return;
      const radio = root.querySelector(`input[name="${id}-mode"][value="${mode}"]`);
      if (radio) radio.checked = true;
    });
  }

  function withExpiryDetail(job, detail) {
    const bits = [];
    if (typeof detail === "string" && detail.trim()) bits.push(detail.trim());
    const stamp = job && typeof job.expiresAt === "string" ? job.expiresAt.trim() : "";
    if (stamp) bits.push(`hold expires ${stamp}`);
    return bits.join(" · ");
  }

  function holdExpired(job, now) {
    if (!job || typeof job.expiresAt !== "string" || !job.expiresAt) return false;
    const expiresMs = Date.parse(job.expiresAt);
    const nowMs = now == null ? Date.now() : Date.parse(String(now));
    return Number.isFinite(expiresMs) && Number.isFinite(nowMs) && nowMs > expiresMs;
  }

  return {
    HINT,
    MODES,
    UNITS,
    bindAutoMode,
    formHtml,
    holdExpired,
    readExpiryFields,
    readFromRoot,
    withExpiryDetail,
  };
});
