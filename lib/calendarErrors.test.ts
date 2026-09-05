import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCalendarFailure,
  googleClientConfigured,
  hasCalendarScope,
  mapCalendarClientError,
  normalizeReason,
} from "./calendarErrors.ts";

test("hasCalendarScope requires a calendar OAuth scope", () => {
  assert.equal(hasCalendarScope(null), false);
  assert.equal(hasCalendarScope("openid email profile"), false);
  assert.equal(hasCalendarScope("openid https://www.googleapis.com/auth/calendar"), true);
  assert.equal(hasCalendarScope("https://www.googleapis.com/auth/calendar.readonly"), true);
});

test("googleClientConfigured needs both env values", () => {
  assert.equal(googleClientConfigured("", "secret"), false);
  assert.equal(googleClientConfigured("id", ""), false);
  assert.equal(googleClientConfigured("id", "secret"), true);
});

test("classifyCalendarFailure reclassifies auth/scope/env — not opaque 500", () => {
  const grant = classifyCalendarFailure({ code: "invalid_grant", message: "invalid_grant" });
  assert.deepEqual(grant, {
    code: "no_token",
    error: "No calendar access token",
    reason: "invalid_grant",
    status: 200,
  });

  const scope = classifyCalendarFailure({
    response: { data: { error: { status: "PERMISSION_DENIED", errors: [{ reason: "insufficientPermissions" }] } } },
  });
  assert.equal(scope.code, "no_token");
  assert.equal(scope.reason, "insufficient_scope");

  const env = classifyCalendarFailure({ message: "Could not determine client ID from request." });
  assert.equal(env.code, "unconfigured");
  assert.equal(env.status, 503);

  const other = classifyCalendarFailure({ response: { data: { error: { status: "BACKEND_ERROR" } } } });
  assert.equal(other.code, "api_error");
  assert.equal(other.status, 502);
  assert.equal(other.reason, "backend_error");
});

test("normalizeReason never echoes tokens or secrets", () => {
  assert.equal(normalizeReason("column \"accessToken\" does not exist"), "account_lookup");
  assert.doesNotMatch(normalizeReason("refresh_token=1//0secret ya29.abc"), /1\/\/|ya29/);
});

test("widget does not map Unauthorized/no_token to api_error", () => {
  assert.equal(mapCalendarClientError(401, { error: "Unauthorized" }), "no_token");
  assert.equal(mapCalendarClientError(200, { error: "No calendar access token" }), "no_token");
  assert.equal(mapCalendarClientError(200, { code: "no_token", error: "No calendar access token" }), "no_token");
  assert.equal(mapCalendarClientError(503, { code: "unconfigured" }), "unconfigured");
  assert.equal(mapCalendarClientError(502, { code: "api_error", reason: "rate_limited" }), "api_error");
  assert.equal(mapCalendarClientError(200, {}), null);
});
