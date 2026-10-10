import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEmergencyExport,
  calculateProfileCompleteness,
  normalizeNoneKnown,
  parseAllergies,
} from "./profileUtils.js";

test("parseAllergies normalizes comma and newline separators and removes duplicates", () => {
  assert.deepEqual(parseAllergies("Peanuts, Lactose\npeanuts\nEggs; Shellfish"), [
    "Peanuts",
    "Lactose",
    "Eggs",
    "Shellfish",
  ]);
});

test("parseAllergies converts legacy none-like values into None known", () => {
  assert.deepEqual(parseAllergies("Nope"), ["None known"]);
  assert.deepEqual(parseAllergies("Peanuts, no medications"), ["Peanuts"]);
});

test("normalizeNoneKnown maps legacy values to the canonical no-known state", () => {
  assert.equal(normalizeNoneKnown("No medications"), "None known");
  assert.equal(normalizeNoneKnown("No known conditions"), "None known");
  assert.equal(normalizeNoneKnown("Asthma"), "Asthma");
});

test("buildEmergencyExport only includes the approved emergency fields and excludes private fields", () => {
  const value = buildEmergencyExport({
    fullName: "Alex Morgan",
    bloodGroup: "O+",
    allergies: "Peanuts, None known",
    conditions: "No medications",
    medications: "No known medications",
    emergencyContactName: "Jamie",
    emergencyContactPhone: "555-010-2020",
    dateOfBirth: "1990-01-01",
    doctorName: "Dr. Reed",
    doctorPhone: "555-010-3030",
    notes: "Private notes here",
    gender: "Other",
  });

  assert.deepEqual(value, {
    fullName: "Alex Morgan",
    bloodGroup: "O+",
    allergies: "Peanuts",
    conditions: "None known",
    medications: "None known",
    emergencyContactName: "Jamie",
    emergencyContactPhone: "555-010-2020",
  });
  assert.equal(value.dateOfBirth, undefined);
  assert.equal(value.doctorName, undefined);
  assert.equal(value.doctorPhone, undefined);
  assert.equal(value.notes, undefined);
  assert.equal(value.gender, undefined);
});

test("calculateProfileCompleteness reports completed emergency fields and a progress percentage", () => {
  const profile = {
    fullName: "Alex Morgan",
    bloodGroup: "O+",
    allergies: "Peanuts",
    conditions: "None known",
    medications: "",
    emergencyContactName: "Jamie",
    emergencyContactPhone: "555-010-2020",
  };

  assert.deepEqual(calculateProfileCompleteness(profile), {
    count: 6,
    total: 7,
    percent: 86,
  });
});
