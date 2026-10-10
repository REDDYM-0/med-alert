import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_HOSPITALS,
  CHITTOOR_HOSPITALS,
  CITIES,
  HYDERABAD_HOSPITALS,
  NELLORE_HOSPITALS,
  TIRUPATI_HOSPITALS,
} from "./hospitals.js";
import { translations } from "./translations.js";

test("CITIES contains the four required cities with normalized IDs", () => {
  const cityIds = CITIES.map((c) => c.id);
  assert.deepEqual(cityIds, ["tirupati", "chittoor", "nellore", "hyderabad"]);
});

test("Each required city has authentic hospital records", () => {
  assert.ok(TIRUPATI_HOSPITALS.length >= 6);
  assert.ok(CHITTOOR_HOSPITALS.length >= 3);
  assert.ok(NELLORE_HOSPITALS.length >= 4);
  assert.ok(HYDERABAD_HOSPITALS.length >= 4);
});

test("Filtering ALL_HOSPITALS by cityId yields only hospitals for that specific city", () => {
  for (const city of CITIES) {
    const cityRecords = ALL_HOSPITALS.filter((h) => h.cityId === city.id);
    assert.ok(cityRecords.length > 0, `Expected records for ${city.id}`);
    cityRecords.forEach((hospital) => {
      assert.equal(hospital.cityId, city.id, `Hospital ${hospital.name} should belong to ${city.id}`);
    });
  }
});

test("City filters never mix records from different cities", () => {
  const tirupatiRecords = ALL_HOSPITALS.filter((h) => h.cityId === "tirupati");
  const chittoorRecords = ALL_HOSPITALS.filter((h) => h.cityId === "chittoor");
  const nelloreRecords = ALL_HOSPITALS.filter((h) => h.cityId === "nellore");
  const hyderabadRecords = ALL_HOSPITALS.filter((h) => h.cityId === "hyderabad");

  assert.ok(tirupatiRecords.every((h) => h.cityId === "tirupati" && h.address.includes("Tirupati")));
  assert.ok(chittoorRecords.every((h) => h.cityId === "chittoor" && h.address.includes("Chittoor")));
  assert.ok(nelloreRecords.every((h) => h.cityId === "nellore" && h.address.includes("Nellore")));
  assert.ok(hyderabadRecords.every((h) => h.cityId === "hyderabad" && h.address.includes("Hyderabad")));
});

test("Search filtering operates strictly within the selected city", () => {
  const selectedCity = "hyderabad";
  const search = "Osmania";
  const cityHospitals = ALL_HOSPITALS.filter((h) => h.cityId === selectedCity);
  const matching = cityHospitals.filter((h) =>
    `${h.name} ${h.address}`.toLowerCase().includes(search.toLowerCase())
  );

  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, "hyderabad-osmania");
});

test("Hospital actions produce valid map directions and phone strings", () => {
  ALL_HOSPITALS.forEach((h) => {
    assert.ok(h.name && h.name.trim().length > 0);
    assert.ok(h.address && h.address.trim().length > 0);
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${h.name}, ${h.address}`)}`;
    assert.ok(directions.startsWith("https://www.google.com/maps/dir/?api=1&destination="));

    if (h.phone) {
      assert.ok(/^\d+$/.test(h.phone), `Phone number ${h.phone} should contain digits only`);
    }
  });
});

test("Translations dictionary includes English and Telugu city and directory labels", () => {
  assert.equal(translations.en.selectCity, "Select City");
  assert.equal(translations.te.selectCity, "నగరాన్ని ఎంచుకోండి");
  assert.equal(translations.en.cities.chittoor, "Chittoor, Andhra Pradesh");
  assert.equal(translations.te.cities.chittoor, "చిత్తూరు, ఆంధ్రప్రదేశ్");
  assert.equal(translations.en.cities.hyderabad, "Hyderabad, Telangana");
  assert.equal(translations.te.cities.hyderabad, "హైదరాబాద్, తెలంగాణ");
});
