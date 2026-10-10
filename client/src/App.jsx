import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Activity, AlertCircle, ArrowRight, Bot, Building2, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardPlus, Download, HeartPulse, MapPin, Menu, MessageCircle, Phone, Plus,
  Printer, RefreshCw, Search, Save, Share2, Shield, ShieldAlert, UserRound, X,
} from "lucide-react";
import { DEMO_PROFILE, EMPTY_PROFILE, GUIDE_LAST_REVIEWED, GUIDES, QUICK_CARDS, TIRUPATI_EMERGENCY_CONTACTS } from "./data";
import { ALL_HOSPITALS, CITIES, TIRUPATI_HOSPITALS } from "./hospitals";
import { buildEmergencyExport, buildEmergencyText, buildQrPayload, buildQrText, calculateProfileCompleteness, normalizeMedicalText, normalizeNoneKnown, parseAllergies } from "./profileUtils";
import { translations } from "./translations";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "emergency", label: "Emergency", icon: ShieldAlert },
  { id: "profile", label: "Medical Profile", icon: ClipboardPlus },
  { id: "hospitals", label: "Hospitals", icon: Building2 },
  { id: "medical-id", label: "Medical ID", icon: ClipboardPlus },
  { id: "guide", label: "Emergency Guide", icon: CircleHelp },
  { id: "assistant", label: "AI Assistant", icon: MessageCircle },
];

const DISCLAIMER = "Med Alert provides general emergency information and does not replace professional medical advice or emergency services.";
const PROFILE_KEY = "med-alert-profile";
const PRIVATE_KEY = "med-alert-private";
const LANGUAGE_KEY = "med-alert-language";
const PAGE_IDS = new Set(NAV_ITEMS.map(({ id }) => id));
const EMERGENCY_FIELDS = ["fullName", "bloodGroup", "allergies", "conditions", "medications", "emergencyContactName", "emergencyContactPhone"];
const PRIVATE_FIELDS = ["dateOfBirth", "doctorName", "doctorPhone", "notes", "gender"];
const EMERGENCY_KEYWORDS = /\b(chest\s*pain|not breathing|unconscious|severe bleeding|choking|seizure|stroke|overdose|suicide|poison(?:ing)?|can't breathe|cannot breathe)\b/i;

function emergencyDetails(profile) {
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

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derivePinKey(pin, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function selectFields(profile, fields) {
  return Object.fromEntries(fields.map((key) => [key, profile[key] || ""]));
}

function wrapCanvasText(context, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function readRoute(hash, pathname = window.location.pathname) {
  if (pathname === "/medical-profile") return { page: "profile", guideId: null };
  const [page, guideId] = hash.replace(/^#\/?/, "").split("/");
  if (page === "guide" && GUIDES.some((guide) => guide.id === guideId)) {
    return { page, guideId };
  }
  return { page: PAGE_IDS.has(page) ? page : "dashboard", guideId: null };
}

function readStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return { value: stored ? JSON.parse(stored) : fallback, error: "" };
  } catch {
    return { value: fallback, error: "Could not read saved information from this browser." };
  }
}

function readStoredString(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return { value: fallback, error: "" };
    try {
      const parsed = JSON.parse(stored);
      return { value: typeof parsed === "string" ? parsed : stored, error: "" };
    } catch {
      return { value: stored, error: "" };
    }
  } catch {
    return { value: fallback, error: "Could not read saved information from this browser." };
  }
}

function normalizeProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_PROFILE };
  return Object.fromEntries(Object.keys(EMPTY_PROFILE).map((key) => {
    const input = typeof value[key] === "string" ? value[key] : "";
    if (key === "allergies") {
      return [key, parseAllergies(input).join(", ")];
    }
    if (key === "conditions" || key === "medications") {
      return [key, normalizeNoneKnown(input)];
    }
    return [key, normalizeMedicalText(input)];
  }));
}

function hasProfileData(profile) {
  return Object.values(profile).some((value) => typeof value === "string" && value.trim());
}

function localDateString(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function phoneUri(value) {
  if (typeof value !== "string") return "";
  const number = value.trim();
  if (!/^\+?[\d\s().-]{3,30}$/.test(number) || (number.match(/\d/g) || []).length < 3) return "";
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

function Button({ children, onClick, variant = "primary", className = "", type = "button", disabled = false, ariaLabel }) {
  const styles = {
    primary: "bg-ink text-white hover:bg-[#243c62] shadow-sm",
    danger: "bg-brand text-white hover:bg-brand-dark shadow-sm",
    outline: "border border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50",
    subtle: "text-slate-600 hover:bg-slate-100",
  };
  return <button type={type} aria-label={ariaLabel} disabled={disabled} onClick={onClick} className={`button-feedback inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

function SectionTitle({ eyebrow, title, description, action }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>}
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
    {action}
  </div>;
}

function Card({ children, className = "" }) {
  return <section className={`card-surface rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 ${className}`}>{children}</section>;
}

function Field({ label, value, onChange, type = "text", placeholder = "", rows, required = false, inputMode, disabled = false, options = [], max }) {
  const shared = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-rose-100";
  return <label className="block text-sm font-semibold text-slate-700">
    {label}{required && <span aria-hidden="true" className="ml-1 text-brand">*</span>}
    {options.length > 0
      ? <select aria-label={label} value={value} onChange={onChange} required={required} disabled={disabled} className={`${shared} min-h-12 disabled:bg-slate-50 disabled:text-slate-500`}>
        <option value="">{placeholder || "Select an option"}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      : rows ? <textarea aria-label={label} rows={rows} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className={`${shared} resize-y disabled:bg-slate-50 disabled:text-slate-500`} /> :
        <input aria-label={label} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} inputMode={inputMode} max={max} disabled={disabled} className={`${shared} min-h-12 disabled:bg-slate-50 disabled:text-slate-500`} />}
  </label>;
}

function EmptyValue({ children = "Not added" }) {
  return <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{children}</span>;
}

function InfoItem({ label, value, prominent = false, allergyTags = false }) {
  const allergies = allergyTags || label.toLowerCase().includes("allerg");
  return <div className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    {allergies
      ? <div className={`mt-1.5 flex flex-wrap gap-1.5 ${prominent ? "text-xl" : "text-sm"}`}>{parseAllergies(value).length ? parseAllergies(value).map((item) => <span key={item} className="rounded-full bg-rose-50 px-2.5 py-1 text-sm font-bold text-brand">{item}</span>) : <EmptyValue />}</div>
      : <p className={`mt-1.5 break-words font-semibold text-ink ${prominent ? "text-xl" : "text-sm"}`}>{value || <EmptyValue />}</p>}
  </div>;
}

function ContactAction({ number, label }) {
  const destination = phoneUri(number);
  const className = `flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${destination ? "bg-white text-ink hover:bg-slate-50" : "cursor-not-allowed bg-white/60 text-slate-400"}`;
  return destination
    ? <a href={destination} className={className}><Phone size={18} />{label}</a>
    : <button type="button" disabled className={className}><Phone size={18} />{label}</button>;
}

function GuideCard({ guide, onOpen }) {
  const Icon = guide.icon;
  return <Card className="card-interactive flex h-full flex-col">
    <div className="mb-4 flex items-start justify-between">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-brand"><Icon size={21} /></span>
      <ChevronRight size={18} className="text-slate-300" />
    </div>
    <h3 className="font-bold text-ink">{guide.title}</h3>
    <p className="mt-1.5 flex-1 text-sm leading-6 text-slate-500">{guide.short}</p>
    <p className="mt-3 text-xs leading-5 text-slate-500"><strong>Source:</strong> {guide.source.split(" (")[0]}</p>
    <p className="text-xs text-slate-500"><strong>Last reviewed:</strong> {GUIDE_LAST_REVIEWED}</p>
    <button onClick={() => onOpen(guide.id)} className="mt-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-sm font-bold text-brand hover:text-brand-dark">View guide <ArrowRight size={15} /></button>
  </Card>;
}

function EmergencyContacts({ t = translations.en }) {
  return <section aria-labelledby="tirupati-emergency-heading">
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">{t.localHelp}</p>
      <h2 id="tirupati-emergency-heading" className="mt-1 text-xl font-bold text-ink">{t.emergencyContacts}</h2>
      <p className="mt-1 text-sm text-slate-500">{t.tapCall}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {TIRUPATI_EMERGENCY_CONTACTS.map(({ id, name, number, description, icon: Icon, primary }) => {
        const localized = t.helplines[id] || { name, description };
        return (
        <article key={id} className={`flex min-w-0 flex-col justify-between gap-4 rounded-2xl border p-4 sm:p-5 ${primary ? "border-brand bg-rose-50 shadow-sm sm:col-span-2 xl:col-span-3 xl:flex-row xl:items-center" : "border-slate-200 bg-white shadow-card"}`}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${primary ? "bg-brand text-white" : "bg-slate-100 text-ink"}`}><Icon size={22} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold leading-5 text-ink">{localized.name}</h3>
                {primary && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">{t.primaryEmergency}</span>}
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-600">{localized.description}</p>
              <p className={`mt-2 font-extrabold tracking-tight ${primary ? "text-3xl text-brand" : "text-2xl text-ink"}`}>{number}</p>
            </div>
          </div>
          <a href={`tel:${number}`} aria-label={`${t.callLabel} ${localized.name} ${number}`} className={`inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand xl:w-auto ${primary ? "bg-brand text-white shadow-sm hover:bg-brand-dark" : "border border-slate-200 bg-white text-ink hover:border-slate-300 hover:bg-slate-50"}`}>
            <Phone size={18} />{t.callNow}
          </a>
        </article>);
      })}
    </div>
  </section>;
}

function HospitalCard({ hospital }) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${hospital.name}, ${hospital.address}`)}`;
  return <article className="card-surface flex min-w-0 flex-col rounded-2xl border border-slate-100 bg-white p-5">
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Building2 size={21} /></span>
      <div className="min-w-0">
        <h3 className="break-words font-bold leading-5 text-ink">{hospital.name}</h3>
        {hospital.emergencyAvailability && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />Emergency availability listed · {hospital.emergencyAvailability}</p>}
      </div>
    </div>
    <p className="mt-4 flex items-start gap-2 text-sm leading-5 text-slate-600"><MapPin className="mt-0.5 shrink-0 text-slate-400" size={16} /><span className="break-words">{hospital.address}</span></p>
    {hospital.phone
      ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink"><Phone className="shrink-0 text-slate-400" size={16} /><span>{hospital.phone}</span>{hospital.phoneLabel && <span className="text-slate-500">· {hospital.phoneLabel}</span>}</p>
      : <p className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-500"><Phone className="shrink-0 text-slate-400" size={16} />Emergency number not listed</p>}
    <p className="mt-2 text-xs font-semibold text-slate-500">Last verified: {hospital.lastVerified || "Not yet verified"}</p>
    {hospital.specialties?.length > 0 && <p className="mt-3 text-sm leading-5 text-slate-600"><span className="font-semibold text-slate-700">Specialties: </span>{hospital.specialties.join(", ")}</p>}
    <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
      {hospital.phone && <a href={`tel:${hospital.phone}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"><Phone size={17} />Call {hospital.phoneLabel || "Hospital"}</a>}
      <a href={directions} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-ink transition hover:border-slate-300 hover:bg-slate-50 ${hospital.phone ? "" : "w-full"}`}><MapPin size={17} />Directions</a>
    </div>
  </article>;
}

function HospitalCards({ hospitals }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {hospitals.map((hospital) => <HospitalCard key={hospital.id} hospital={hospital} />)}
  </div>;
}

function HospitalDirectory({ t }) {
  const [selectedCity, setSelectedCity] = useState(() => {
    try {
      return sessionStorage.getItem("med-alert-selected-city") || "";
    } catch {
      return "";
    }
  });
  const [search, setSearch] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const mapsFallback = "https://www.google.com/maps/search/?api=1&query=hospital%20near%20me";

  function handleCityChange(cityId) {
    setSelectedCity(cityId);
    try {
      if (cityId) {
        sessionStorage.setItem("med-alert-selected-city", cityId);
      } else {
        sessionStorage.removeItem("med-alert-selected-city");
      }
    } catch {
      // Ignore storage errors
    }
  }

  function findNearest() {
    const mapWindow = window.open("about:blank", "_blank");
    if (mapWindow) mapWindow.opener = null;
    if (!mapWindow) {
      setLocationMessage("Allow pop-ups to open Maps, or use the general Maps search link.");
      return;
    }
    if (!navigator.geolocation) {
      setLocationMessage("Location is unavailable. Opening a general Maps search.");
      mapWindow.location.href = mapsFallback;
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapWindow.location.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hospital near ${coords.latitude},${coords.longitude}`)}`;
      },
      (error) => {
        setLocationMessage(error.code === 1
          ? "Location permission was not granted. Use the general Maps search link."
          : "Could not get your location. Opening the general Maps search.");
        mapWindow.location.href = mapsFallback;
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  const activeCity = CITIES.find((c) => c.id === selectedCity);
  const activeCityLabel = selectedCity ? (t?.cities?.[selectedCity] || activeCity?.label || selectedCity) : "";

  const cityHospitals = selectedCity
    ? ALL_HOSPITALS.filter((h) => h.cityId === selectedCity)
    : [];

  const visibleHospitals = cityHospitals.filter((hospital) => {
    const matchesSearch = `${hospital.name} ${hospital.address} ${(hospital.specialties || []).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (!emergencyOnly || Boolean(hospital.emergencyAvailability));
  });

  return <div className="mx-auto max-w-6xl">
    <SectionTitle
      eyebrow={selectedCity ? activeCityLabel : (t?.hospitalDirectory || "Hospital Directory")}
      title={selectedCity ? `${t?.hospitalsIn || "Hospitals in"} ${activeCityLabel}` : (t?.hospitalDirectory || "Hospital Directory")}
      description="Select a city to view local medical facilities. Confirm emergency availability directly with the hospital when needed. Location is sent to Google Maps only when you tap Nearest hospital and is not saved by Med Alert."
      action={<Button variant="outline" onClick={findNearest}><MapPin size={17} />Nearest hospital</Button>}
    />

    {locationMessage && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{locationMessage} <a className="font-bold underline" href={mapsFallback} target="_blank" rel="noreferrer">Open Maps search</a></p>}

    <section aria-label="City Selection" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="hospital-city-select" className="text-sm font-bold text-slate-700">
          {t?.selectCity || "Select City"}
        </label>
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <select
            id="hospital-city-select"
            aria-label={t?.selectCity || "Select City"}
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-rose-100"
          >
            <option value="">{t?.selectCityPrompt || "-- Select City --"}</option>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t?.cities?.[c.id] || c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>

    {!selectedCity ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm">
        <Building2 className="mx-auto text-slate-400" size={32} />
        <h2 className="mt-3 text-lg font-bold text-ink">{t?.selectCityInstruction || "Select a city to view available hospitals."}</h2>
        <p className="mt-1 text-sm text-slate-500">Choose a city from the dropdown above to view genuine medical facilities.</p>
      </div>
    ) : (
      <>
        <section aria-label="Search and filter hospitals" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:gap-4">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search hospitals</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by hospital or address" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-rose-100" />
          </label>
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700 sm:mt-0 sm:shrink-0">
            <input type="checkbox" checked={emergencyOnly} onChange={(event) => setEmergencyOnly(event.target.checked)} className="h-4 w-4 accent-[#e8414f]" />
            Emergency availability listed
          </label>
        </section>

        {visibleHospitals.length > 0 ? (
          <HospitalCards hospitals={visibleHospitals} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <Building2 className="mx-auto text-slate-400" size={26} />
            <h2 className="mt-3 font-bold text-ink">
              {cityHospitals.length === 0
                ? (t?.noHospitalsInCity || "No hospitals found for the selected city.")
                : "No hospitals match your search"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {cityHospitals.length === 0
                ? "Try selecting another city from the dropdown."
                : (emergencyOnly ? "No other hospitals in this city have confirmed emergency availability." : "Try a different hospital name or address.")}
            </p>
          </div>
        )}
      </>
    )}
  </div>;
}

function NearbyHospitals({ navigate }) {
  return <section aria-labelledby="nearby-hospitals-heading">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">Tirupati, Andhra Pradesh</p>
        <h2 id="nearby-hospitals-heading" className="mt-1 text-xl font-bold text-ink">Nearby Hospitals</h2>
        <p className="mt-1 text-sm text-slate-500">Hospital locations in Tirupati. Use Directions to check routes.</p>
      </div>
      <Button variant="outline" onClick={() => navigate("hospitals")} className="min-h-11"><Building2 size={17} />All hospitals</Button>
    </div>
    <HospitalCards hospitals={TIRUPATI_HOSPITALS} />
  </section>;
}

function medicalIdText(profile) {
  return buildEmergencyText(profile);
}

function MedicalIdField({ label, value }) {
  return <div className="min-w-0">
    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1.5 break-words whitespace-pre-wrap font-semibold leading-6 text-ink">{value || <EmptyValue />}</p>
  </div>;
}

function MedicalId({ profile, navigate, t }) {
  const [message, setMessage] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [qrCode, setQrCode] = useState("");

  const contact = [profile.emergencyContactName, profile.emergencyContactPhone, profile.emergencyContactRelationship].filter(Boolean).join(" · ");
  const contactPhone = phoneUri(profile.emergencyContactPhone);
  const shareText = buildEmergencyText(profile);
  const qrText = useMemo(() => buildQrText(profile), [profile]);
  const isProfileEmpty = !profile.fullName && !profile.emergencyContactPhone && !profile.emergencyContactName;

  function generateQrCode() {
    if (isProfileEmpty) {
      setQrCode("");
      return;
    }
    QRCode.toDataURL(qrText, { errorCorrectionLevel: "M", margin: 2, width: 360 })
      .then((dataUrl) => setQrCode(dataUrl))
      .catch(() => setMessage(t?.qrError || "Could not generate the QR code on this device."));
  }

  useEffect(() => {
    generateQrCode();
  }, [qrText, isProfileEmpty]);

  function downloadQrPng() {
    if (!qrCode) return;
    const link = document.createElement("a");
    link.href = qrCode;
    link.download = "med-alert-qr-code.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessage(t?.downloadQrPng ? "QR code PNG downloaded." : "QR code image downloaded.");
  }

  async function copyDetails() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard access is unavailable.");
      }
      setFallbackText("");
      setMessage("Medical ID details copied. Share them only with someone you trust.");
    } catch {
      setFallbackText(shareText);
      setMessage("Automatic copying is unavailable. Select and copy the text below.");
    }
  }

  async function shareDetails() {
    if (typeof navigator.share !== "function") {
      await copyDetails();
      return;
    }
    try {
      await navigator.share({ title: "Med Alert Digital Medical ID", text: shareText });
      setMessage("Medical ID shared.");
    } catch (error) {
      if (error.name !== "AbortError") {
        setMessage("Could not open the share sheet. You can copy or download your Medical ID instead.");
      }
    }
  }

  function downloadDetails() {
    const blob = new Blob([shareText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "med-alert-medical-id.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Medical ID downloaded to this device. Keep the file private.");
  }

  async function saveLockScreen() {
    if (!qrCode) {
      setMessage("The QR code is not ready yet. Please try again.");
      return;
    }
    try {
      const qrImage = new Image();
      qrImage.src = qrCode;
      await qrImage.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 2340;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.fillStyle = "#f5f7fa";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#172b4d";
      context.fillRect(0, 0, canvas.width, 360);
      context.fillStyle = "#ffffff";
      context.font = "bold 40px system-ui, sans-serif";
      context.fillText("MED ALERT · EMERGENCY ID", 72, 105);
      context.font = "bold 76px system-ui, sans-serif";
      context.fillText((profile.fullName || "Name not provided").slice(0, 28), 72, 220);
      context.font = "bold 44px system-ui, sans-serif";
      context.fillText(`Blood group: ${profile.bloodGroup || "Not provided"}`, 72, 295);
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.roundRect(48, 410, 984, 790, 36);
      context.fill();
      context.fillStyle = "#172b4d";
      context.font = "bold 38px system-ui, sans-serif";
      context.fillText("ALLERGIES", 88, 490);
      context.font = "36px system-ui, sans-serif";
      const allergies = parseAllergies(profile.allergies).join(", ") || "Not provided";
      const allergyLines = wrapCanvasText(context, allergies, 900);
      allergyLines.slice(0, 4).forEach((line, index) => context.fillText(line, 88, 550 + index * 50));
      context.font = "bold 38px system-ui, sans-serif";
      context.fillText("EMERGENCY CONTACT", 88, 810);
      context.font = "36px system-ui, sans-serif";
      const contactLines = wrapCanvasText(context, contact || "Not provided", 900);
      contactLines.slice(0, 4).forEach((line, index) => context.fillText(line, 88, 870 + index * 50));
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.roundRect(250, 1270, 580, 720, 36);
      context.fill();
      context.drawImage(qrImage, 330, 1350, 420, 420);
      context.fillStyle = "#172b4d";
      context.textAlign = "center";
      context.font = "bold 34px system-ui, sans-serif";
      context.fillText("Scan for emergency details", 540, 1850);
      context.textAlign = "left";
      context.font = "28px system-ui, sans-serif";
      context.fillText("QR includes only the emergency fields.", 72, 2120);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not create the PNG.")), "image/png"));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "med-alert-lock-screen.png";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Lock-screen image downloaded to this device.");
    } catch {
      setMessage("Could not create the lock-screen image on this device.");
    }
  }

  return <div className="mx-auto max-w-4xl">
    <SectionTitle eyebrow="Private · stored on this device" title="Digital Medical ID" description="A quick-to-read card generated from your saved Medical Profile. Review it before printing or sharing." />
    
    <div className="medical-id-hide-print mb-5 flex flex-wrap gap-2">
      <Button variant="danger" onClick={() => window.print()} className="min-h-11"><Printer size={17} />{t?.printMedicalId || "Print / Save PDF"}</Button>
      {qrCode && <Button variant="outline" onClick={downloadQrPng} className="min-h-11"><Download size={17} />{t?.downloadQrPng || "Download QR Code (PNG)"}</Button>}
      <Button variant="outline" onClick={saveLockScreen} className="min-h-11"><Download size={17} />{t?.downloadLockScreen || "Save Lock-Screen Image"}</Button>
      <Button variant="outline" onClick={downloadDetails} className="min-h-11"><Download size={17} />Download ID Text</Button>
      <Button variant="outline" onClick={shareDetails} className="min-h-11"><Share2 size={17} />Share ID</Button>
      <Button variant="outline" onClick={copyDetails} className="min-h-11"><ClipboardPlus size={17} />Copy details</Button>
    </div>

    {message && <p role="status" className="medical-id-hide-print mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">{message}</p>}

    <article className="medical-id-print overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-ink px-5 py-5 text-white sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand"><HeartPulse size={25} strokeWidth={2.4} /></span>
          <div><p className="text-lg font-extrabold tracking-tight">med<span className="text-rose-300">alert</span></p><p className="text-xs font-medium text-white/70">DIGITAL MEDICAL ID</p></div>
        </div>
        <span className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90">Emergency information</span>
      </div>
      <div className="p-5 sm:p-8">
        <div className="mb-6 border-b border-slate-100 pb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Patient</p>
          <h2 className="mt-1 break-words text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{profile.fullName || "Name not added"}</h2>
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-brand"><HeartPulse size={17} />Blood group: {profile.bloodGroup || "Not added"}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Allergies</p>
            <div className="mt-2 flex flex-wrap gap-2">{parseAllergies(profile.allergies).length ? parseAllergies(profile.allergies).map((allergy) => <span key={allergy} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-brand">{allergy}</span>) : <EmptyValue />}</div>
          </div>
          <MedicalIdField label="Medical conditions" value={profile.conditions} />
          <MedicalIdField label="Current medications" value={profile.medications} />
        </div>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Emergency contact</p>
            <p className="mt-1.5 break-words font-bold text-ink">{contact || "Not added"}</p>
          </div>
          {contactPhone && <a href={contactPhone} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-white transition hover:bg-brand-dark"><Phone size={18} />Call Emergency Contact</a>}
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500 sm:px-8">
        Keep this card private. It is generated in your browser and is not published or sent to a Med Alert server. Excludes date of birth, doctor details, and notes.
      </div>
    </article>

    {/* Smart Medical ID QR Code Section */}
    <div className="medical-id-hide-print mt-6 flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-extrabold text-ink">{t?.qrGeneratorHeading || "Smart Medical ID QR Code Generator"}</h2>
      
      {isProfileEmpty ? (
        <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm font-medium text-amber-900">
          {t?.qrValidationEmpty || "Please add at least your full name or emergency contact in your Medical Profile to generate a valid QR code."}
        </div>
      ) : qrCode ? (
        <div className="mt-4 flex flex-col items-center gap-4">
          <img src={qrCode} alt="Smart Medical ID QR Code" width="240" height="240" className="h-60 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-md" />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={generateQrCode} className="min-h-11"><RefreshCw size={17} />{t?.generateQr || "Generate / Refresh QR"}</Button>
            <Button variant="outline" onClick={downloadQrPng} className="min-h-11"><Download size={17} />{t?.downloadQrPng || "Download QR Code (PNG)"}</Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{t?.qrLoading || "Generating secure local QR code…"}</p>
      )}

      {/* Warning Box */}
      <div className="mt-6 w-full rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-left text-xs leading-5 text-amber-950">
        <p className="font-bold">{t?.qrPrivacyWarning || "This QR code contains emergency medical information in readable form. Anyone who scans it may be able to see those details. Only print or share it if you are comfortable with that."}</p>
        <p className="mt-2 text-amber-800">{t?.qrSharedCopyWarning || "Note: Removing a downloaded QR image from this app does not delete copies already saved or shared elsewhere."}</p>
      </div>
    </div>

    {fallbackText && <div className="medical-id-hide-print mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <label htmlFor="medical-id-copy-fallback" className="block text-sm font-bold text-amber-950">Copy Medical ID text manually</label>
      <textarea id="medical-id-copy-fallback" readOnly value={fallbackText} onFocus={(event) => event.currentTarget.select()} className="mt-2 min-h-40 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm leading-5 text-ink" />
    </div>}

    {!profile.fullName && <div className="medical-id-hide-print mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">Your Medical ID is mostly empty. Add your details to your profile first.</p>
      <Button variant="outline" onClick={() => navigate("profile")} className="shrink-0">Edit Medical Profile <ArrowRight size={15} /></Button>
    </div>}
  </div>;
}

function GuidePage({ guide, onOpen }) {
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:px-5">
      <div><p className="font-extrabold text-brand">Call 108 first</p><p className="mt-1 text-sm leading-5 text-rose-900">Do not delay emergency services to use this guide.</p></div>
      <a href="tel:108" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-dark"><Phone size={17} />Call 108</a>
    </div>
    <SectionTitle eyebrow="Quick first-response information" title={guide ? guide.title : "Emergency Guide"} description="Concise general guidance for common emergencies. This is not a substitute for professional medical care." action={guide ? <Button variant="outline" onClick={() => onOpen(null)}>All guides</Button> : null} />
    {!guide ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{GUIDES.map((item) => <GuideCard key={item.id} guide={item} onOpen={onOpen} />)}</div> :
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Card><h2 className="mb-4 flex items-center gap-2 font-bold text-ink"><span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-brand"><Activity size={18} /></span>What to do immediately</h2>
            <ol className="space-y-3">{guide.immediate.map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-50 text-xs font-extrabold text-brand">{index + 1}</span>{item}</li>)}</ol>
          </Card>
          <Card><h2 className="mb-4 flex items-center gap-2 font-bold text-ink"><span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600"><AlertCircle size={18} /></span>What NOT to do</h2>
            <ul className="space-y-3">{guide.avoid.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{item}</li>)}</ul>
          </Card>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-brand p-5 text-white shadow-card"><h2 className="flex items-center gap-2 font-extrabold"><Phone size={19} />When to call emergency services</h2><p className="mt-3 text-sm leading-6 text-white/90">{guide.call}</p><p className="mt-4 border-t border-white/20 pt-3 text-xs leading-5 text-white/75">Call your local emergency number. Do not delay to use this app.</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="flex gap-2 text-sm font-bold text-amber-900"><AlertCircle className="mt-0.5 shrink-0" size={17} />General information only</p><p className="mt-2 text-xs leading-5 text-amber-800">Emergency response varies by person and location. Follow professional dispatcher instructions and seek qualified care.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600"><p><strong>Source:</strong> {guide.source}</p><p className="mt-2"><strong>Last reviewed:</strong> {GUIDE_LAST_REVIEWED}</p></div>
        </div>
      </div>}
    <div className="mt-7 border-t border-slate-200 pt-6"><h2 className="mb-4 font-bold text-ink">Other quick guides</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{GUIDES.filter((item) => item.id !== guide?.id).map((item) => <button key={item.id} onClick={() => onOpen(item.id)} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-700 hover:border-rose-200 hover:text-brand"><span className="flex items-center gap-2"><item.icon size={17} className="text-brand" />{item.title}</span><ChevronRight size={16} /></button>)}</div></div>
  </div>;
}

function Assistant({ messages, input, setInput, loading, error, onSend, onClear, endRef, emergencyAlert, online }) {
  const statusLabel = !online ? "Offline · local responses" : loading ? "Responding" : error ? "Service issue" : messages.length ? "Conversation" : "Guidance";
  const statusClass = error ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700";
  return <div className="mx-auto max-w-3xl">
    {emergencyAlert && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-950 sm:px-5"><p className="font-extrabold">This may be an emergency. Call 108 now.</p><a href="tel:108" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white"><Phone size={17} />Call 108</a></div>}
    <p className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">General information only, not medical advice.</p>
    {!online && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You are offline. This on-device assistant can still show general safety guidance, but it cannot contact emergency services or a clinician.</p>}
    <SectionTitle eyebrow="General first-response information" title="AI Assistant" description="Fixed safety responses run on this device; messages are not sent to a server. This tool is not AI-generated or personalized and cannot diagnose or recommend medicines or dosages." action={messages.length > 0 ? <Button variant="outline" disabled={loading} onClick={onClear}><X size={16} />Clear conversation</Button> : null} />
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 sm:flex-nowrap sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Bot size={21} /></span>
        <div className="min-w-[150px] flex-1"><p className="font-bold leading-5 text-ink">Med Alert Assistant</p><p className="mt-0.5 text-xs leading-4 text-slate-500">On-device general information · Not a medical professional</p></div>
        <span role="status" className={`ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}><span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-blue-500" : error ? "bg-amber-500" : "bg-emerald-500"}`} />{statusLabel}</span>
      </div>
      <div className="flex min-h-[360px] max-h-[58vh] flex-col gap-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
        {messages.length === 0 && <div className="m-auto max-w-sm py-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand shadow-card"><MessageCircle size={25} /></span><h2 className="mt-4 font-bold text-ink">How can I help right now?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Describe the situation to see general safety guidance. This tool does not evaluate symptoms, diagnose, or replace professional care.</p></div>}
        {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[88%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-ink text-white" : "rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm"}`}><p className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-60">{message.role === "user" ? "You" : "General guidance"}</p><p className="break-words whitespace-pre-wrap">{message.text}</p></div>
        </div>)}
        {loading && <div role="status" className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"><span className="inline-flex items-center gap-2.5"><span className="inline-flex items-center gap-1" aria-hidden="true"><span className="assistant-loading-dot h-1.5 w-1.5 rounded-full bg-brand" /><span className="assistant-loading-dot h-1.5 w-1.5 rounded-full bg-brand" /><span className="assistant-loading-dot h-1.5 w-1.5 rounded-full bg-brand" /></span>Preparing general guidance…</span></div></div>}
        <div ref={endRef} />
      </div>
      {error && <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 sm:mx-6"><AlertCircle className="mt-0.5 shrink-0" size={17} /><span>{error}</span></div>}
      <form onSubmit={onSend} className="border-t border-slate-100 bg-white p-4 sm:p-5">
        <label htmlFor="assistant-input" className="sr-only">Describe symptoms or emergency</label>
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-rose-100">
          <textarea id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} maxLength={2000} placeholder="Describe what is happening…" className="max-h-32 min-h-11 flex-1 resize-y border-0 px-2 py-2 text-sm text-ink outline-none placeholder:text-slate-400" />
          <Button type="submit" variant="danger" disabled={loading || !input.trim()} className="min-h-10 px-3" ariaLabel="Send message"><span className="hidden sm:inline">Send</span><ArrowRight size={17} /></Button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-400">Do not include unnecessary personal or identifying information. {input.length}/2000</p>
      </form>
    </Card>
    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Important:</strong> General information only, not medical advice. This tool does not diagnose or prescribe medication or dosages. See a doctor and never delay emergency care to use this tool.</p>
  </div>;
}

export default App;
