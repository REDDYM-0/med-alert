import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";

import { buildEmergencyExport, buildQrPayload, buildQrText } from "./profileUtils.js";
import { translations } from "./translations.js";

const FULL_DEMO_PROFILE = {
  fullName: "Alex Morgan",
  dateOfBirth: "1990-05-15",
  gender: "Female",
  bloodGroup: "O+",
  allergies: "Peanuts, Penicillin",
  conditions: "Asthma",
  medications: "Albuterol inhaler",
  emergencyContactName: "Jamie Morgan",
  emergencyContactPhone: "555-010-2020",
  emergencyContactRelationship: "Spouse",
  doctorName: "Dr. Taylor Reed",
  doctorPhone: "555-010-4040",
  notes: "Highly sensitive medical notes - private only",
  pinHash: "secret_hash",
  salt: "secret_salt",
};

test("buildQrPayload constructs payload from strict approved allowlist only", () => {
  const payload = buildQrPayload(FULL_DEMO_PROFILE);

  const expectedKeys = [
    "v",
    "type",
    "fullName",
    "bloodGroup",
    "allergies",
    "conditions",
    "medications",
    "emergencyContactName",
    "emergencyContactPhone",
  ];

  assert.deepEqual(Object.keys(payload), expectedKeys);
  assert.equal(payload.v, 1);
  assert.equal(payload.type, "MED_ALERT_EMERGENCY_ID");
  assert.equal(payload.fullName, "Alex Morgan");
  assert.equal(payload.bloodGroup, "O+");
  assert.equal(payload.allergies, "Peanuts, Penicillin");
  assert.equal(payload.conditions, "Asthma");
  assert.equal(payload.medications, "Albuterol inhaler");
  assert.equal(payload.emergencyContactName, "Jamie Morgan");
  assert.equal(payload.emergencyContactPhone, "555-010-2020");
});

test("buildQrPayload strictly excludes all private fields and credentials", () => {
  const payload = buildQrPayload(FULL_DEMO_PROFILE);

  assert.equal(payload.dateOfBirth, undefined);
  assert.equal(payload.gender, undefined);
  assert.equal(payload.doctorName, undefined);
  assert.equal(payload.doctorPhone, undefined);
  assert.equal(payload.notes, undefined);
  assert.equal(payload.pinHash, undefined);
  assert.equal(payload.salt, undefined);
  assert.equal(payload.emergencyContactRelationship, undefined);
});

test("buildQrPayload handles empty or partial profile without error", () => {
  const payload = buildQrPayload({});
  assert.equal(payload.v, 1);
  assert.equal(payload.type, "MED_ALERT_EMERGENCY_ID");
  assert.equal(payload.fullName, "");
  assert.equal(payload.allergies, "");
  assert.equal(payload.conditions, "");
});

test("buildQrText serializes QR payload as formatted JSON string with version tag", () => {
  const jsonString = buildQrText(FULL_DEMO_PROFILE);
  const parsed = JSON.parse(jsonString);

  assert.equal(parsed.v, 1);
  assert.equal(parsed.type, "MED_ALERT_EMERGENCY_ID");
  assert.equal(parsed.fullName, "Alex Morgan");
  assert.equal(parsed.dateOfBirth, undefined);
  assert.equal(parsed.notes, undefined);
});

test("QRCode library generates valid base64 PNG data URL locally", async () => {
  const jsonText = buildQrText(FULL_DEMO_PROFILE);
  const dataUrl = await QRCode.toDataURL(jsonText, { errorCorrectionLevel: "M", margin: 2, width: 360 });

  assert.ok(dataUrl.startsWith("data:image/png;base64,"));
  assert.ok(dataUrl.length > 500);
});

test("Handles long names and extensive medical details in QR payload", () => {
  const longProfile = {
    ...FULL_DEMO_PROFILE,
    fullName: "Alexander Bartholomew Montgomery-Wellington the Third",
    allergies: "Peanuts, Penicillin, Shellfish, Latex, Bee Stings, Dust Mites, Mold, Sulfa Drugs",
    conditions: "Asthma, Hypertension, Type 2 Diabetes, Gastroesophageal Reflux Disease",
    medications: "Albuterol inhaler 90mcg, Lisinopril 10mg daily, Metformin 500mg twice daily, Omeprazole 20mg",
  };

  const payload = buildQrPayload(longProfile);
  assert.equal(payload.fullName, "Alexander Bartholomew Montgomery-Wellington the Third");
  assert.ok(payload.allergies.includes("Bee Stings"));
  assert.ok(payload.medications.includes("Metformin"));

  const jsonText = buildQrText(longProfile);
  assert.ok(jsonText.length > 300);
});

test("English and Telugu translations include all required QR generator keys", () => {
  const requiredKeys = [
    "qrGeneratorHeading",
    "generateQr",
    "downloadQrPng",
    "qrPrivacyWarning",
    "qrSharedCopyWarning",
    "qrValidationEmpty",
    "qrLoading",
    "qrError",
    "downloadLockScreen",
    "printMedicalId",
  ];

  requiredKeys.forEach((key) => {
    assert.ok(translations.en[key], `English translation missing key: ${key}`);
    assert.ok(translations.te[key], `Telugu translation missing key: ${key}`);
  });
});
