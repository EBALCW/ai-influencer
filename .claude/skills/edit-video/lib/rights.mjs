export const RIGHTS_STATUSES = Object.freeze([
  "analysis-only",
  "owned",
  "licensed",
  "public-domain",
  "cc0",
  "cc-by",
]);

const REUSABLE = new Set(["owned", "licensed", "public-domain", "cc0", "cc-by"]);

export function validateRightsStatus(value = "analysis-only") {
  if (!RIGHTS_STATUSES.includes(value)) {
    throw new Error(`Invalid rights status '${value}'. Use one of: ${RIGHTS_STATUSES.join(", ")}`);
  }
  return value;
}

export function isReusableInOutput(status) {
  return REUSABLE.has(validateRightsStatus(status));
}

export function validateRightsEvidence(status, { rightsNote, attribution } = {}) {
  validateRightsStatus(status);
  if (status === "licensed" && !String(rightsNote ?? "").trim()) {
    throw new Error("--rights-note is required for licensed media");
  }
  if (status === "cc-by" && !String(attribution ?? "").trim()) {
    throw new Error("--attribution is required for CC BY media");
  }
}

export function createRightsRecord(status, details = {}) {
  validateRightsEvidence(status, details);
  return {
    status,
    reusableInOutput: isReusableInOutput(status),
    assertedByUser: status !== "analysis-only",
    rightsNote: details.rightsNote || null,
    attribution: details.attribution || null,
  };
}
