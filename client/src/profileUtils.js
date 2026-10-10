export const LEGACY_NONE_VALUES = new Set([
  "none",
  "none known",
  "nope",
  "no allergies",
  "no allergy",
  "no known allergies",
  "no medications",
  "no medication",
  "no medicine",
  "no meds",
  "no conditions",
  "no known conditions",
  "no medical conditions",
  "no known medications",
  "no current medications",
]);

function isLegacyNoneValue(value) {
  const sanitized = normalizeMedicalText(value).toLowerCase();
  return sanitized ? LEGACY_NONE_VALUES.has(sanitized) : false;
}

export function normalizeMedicalText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeNoneKnown(value) {
  if (typeof value !== "string") return "";
  if (!value.trim()) return "";
  return isLegacyNoneValue(value) ? "None known" : normalizeMedicalText(value);
}

export function parseAllergies(value) {
  const entries = (value || "")
    .split(/[\n,;]+/)
    .map((item) => normalizeMedicalText(item))
    .filter(Boolean);

  const recognizedNone = entries.some((entry) => isLegacyNoneValue(entry));
  const filteredEntries = entries.filter((entry) => !isLegacyNoneValue(entry));

  if (recognizedNone && filteredEntries.length === 0) {
    return ["None known"];
  }

  const unique = [];
  const seen = new Set();
  filteredEntries.forEach((entry) => {
    const key = entry.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  });

  return unique;
}

export function calculateProfileCompleteness(profile) {
  const requiredFields = [
    "fullName",
    "bloodGroup",
    "allergies",
    "conditions",
    "medications",
    "emergencyContactName",
    "emergencyContactPhone",
  ];

  const completeCount = requiredFields.filter((field) => {
    const value = profile?.[field];
    return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  }).length;

  return {
    count: completeCount,
    total: requiredFields.length,
    percent: Math.round((completeCount / requiredFields.length) * 100),
  };
}

export function buildEmergencyExport(profile) {
  return {
    fullName: normalizeMedicalText(profile?.fullName || ""),
    bloodGroup: normalizeMedicalText(profile?.bloodGroup || ""),
    allergies: parseAllergies(profile?.allergies || "").join(", "),
    conditions: normalizeNoneKnown(profile?.conditions || ""),
    medications: normalizeNoneKnown(profile?.medications || ""),
    emergencyContactName: normalizeMedicalText(profile?.emergencyContactName || ""),
    emergencyContactPhone: normalizeMedicalText(profile?.emergencyContactPhone || ""),
  };
}

export function buildEmergencyText(profile) {
  const exportFields = buildEmergencyExport(profile);
  return [
    `Name: ${exportFields.fullName || "Not provided"}`,
    `Blood group: ${exportFields.bloodGroup || "Not provided"}`,
    `Allergies: ${exportFields.allergies || "Not provided"}`,
    `Medical conditions: ${exportFields.conditions || "Not provided"}`,
    `Current medications: ${exportFields.medications || "Not provided"}`,
    `Emergency contact name: ${exportFields.emergencyContactName || "Not provided"}`,
    `Emergency contact phone: ${exportFields.emergencyContactPhone || "Not provided"}`,
  ].join("\n");
}
