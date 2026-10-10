import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Activity, AlertCircle, ArrowRight, Bot, Building2, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardPlus, Download, HeartPulse, MapPin, Menu, MessageCircle, Phone, Plus,
  Printer, Search, Save, Share2, Shield, ShieldAlert, UserRound, X,
} from "lucide-react";
import { DEMO_PROFILE, EMPTY_PROFILE, GUIDE_LAST_REVIEWED, GUIDES, QUICK_CARDS, TIRUPATI_EMERGENCY_CONTACTS } from "./data";
import { TIRUPATI_HOSPITALS } from "./hospitals";
import { buildEmergencyExport, buildEmergencyText, calculateProfileCompleteness, normalizeMedicalText, normalizeNoneKnown, parseAllergies } from "./profileUtils";
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

function HospitalDirectory() {
  const [search, setSearch] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const mapsFallback = "https://www.google.com/maps/search/?api=1&query=hospital%20near%20me";
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
  const visibleHospitals = TIRUPATI_HOSPITALS.filter((hospital) => {
    const matchesSearch = `${hospital.name} ${hospital.address} ${(hospital.specialties || []).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (!emergencyOnly || Boolean(hospital.emergencyAvailability));
  });

  return <div className="mx-auto max-w-6xl">
    <SectionTitle eyebrow="Tirupati, Andhra Pradesh" title="Tirupati Hospitals" description="Hospital addresses and contact details available in this directory. Confirm availability directly with the hospital when needed. Location is sent to Google Maps only when you tap Nearest hospital and is not saved by Med Alert." action={<Button variant="outline" onClick={findNearest}><MapPin size={17} />Nearest hospital</Button>} />
    {locationMessage && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{locationMessage} <a className="font-bold underline" href={mapsFallback} target="_blank" rel="noreferrer">Open Maps search</a></p>}
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
    {visibleHospitals.length > 0
      ? <HospitalCards hospitals={visibleHospitals} />
      : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
        <Building2 className="mx-auto text-slate-400" size={26} />
        <h2 className="mt-3 font-bold text-ink">No hospitals match your search</h2>
        <p className="mt-1 text-sm text-slate-500">{emergencyOnly ? "No other hospitals in this directory have confirmed emergency availability." : "Try a different hospital name or address."}</p>
      </div>}
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

function MedicalId({ profile, navigate }) {
  const [message, setMessage] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [qrCode, setQrCode] = useState("");
  const contact = [profile.emergencyContactName, profile.emergencyContactPhone, profile.emergencyContactRelationship].filter(Boolean).join(" · ");
  const contactPhone = phoneUri(profile.emergencyContactPhone);
  const shareText = buildEmergencyText(profile);
  const qrText = emergencyDetails(profile);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrText, { errorCorrectionLevel: "M", margin: 2, width: 320 })
      .then((dataUrl) => { if (active) setQrCode(dataUrl); })
      .catch(() => { if (active) setMessage("Could not generate the QR code on this device."); });
    return () => { active = false; };
  }, [qrText]);

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
      <Button variant="danger" onClick={() => window.print()} className="min-h-11"><Printer size={17} />Print / Save PDF</Button>
      <Button variant="outline" onClick={downloadDetails} className="min-h-11"><Download size={17} />Download ID</Button>
      <Button variant="outline" onClick={shareDetails} className="min-h-11"><Share2 size={17} />Share ID</Button>
      <Button variant="outline" onClick={copyDetails} className="min-h-11"><ClipboardPlus size={17} />Copy details</Button>
      <Button variant="outline" onClick={saveLockScreen} className="min-h-11"><Download size={17} />Save as lock-screen image</Button>
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
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MedicalIdField label="Date of birth" value={profile.dateOfBirth || "Not provided"} />
            <MedicalIdField label="Gender" value={profile.gender} />
          </div>
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-brand"><HeartPulse size={17} />Blood group: {profile.bloodGroup || "Not added"}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Allergies</p>
            <div className="mt-2 flex flex-wrap gap-2">{parseAllergies(profile.allergies).length ? parseAllergies(profile.allergies).map((allergy) => <span key={allergy} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-brand">{allergy}</span>) : <EmptyValue />}</div>
          </div>
          <MedicalIdField label="Medical conditions" value={profile.conditions} />
          <MedicalIdField label="Current medications" value={profile.medications} />
          <div className="sm:col-span-2"><MedicalIdField label="Important medical notes" value={profile.notes} /></div>
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
        Keep this card private. It is generated in your browser and is not published or sent to a Med Alert server.
      </div>
    </article>
    <div className="medical-id-hide-print mt-5 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center">
      <h2 className="font-bold text-ink">Emergency QR code</h2>
      {qrCode ? <img src={qrCode} alt="QR code containing only emergency medical details" width="220" height="220" className="h-56 w-56" /> : <p className="text-sm text-slate-500">Generating QR code…</p>}
      <p className="max-w-xl text-xs leading-5 text-slate-600">The QR code contains your emergency details in readable form. Anyone who scans it can see them. Only print or share it if you are comfortable with that.</p>
    </div>
    {fallbackText && <div className="medical-id-hide-print mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <label htmlFor="medical-id-copy-fallback" className="block text-sm font-bold text-amber-950">Copy Medical ID text manually</label>
      <textarea id="medical-id-copy-fallback" readOnly value={fallbackText} onFocus={(event) => event.currentTarget.select()} className="mt-2 min-h-40 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm leading-5 text-ink" />
    </div>}
    <p className="medical-id-hide-print mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Privacy reminder:</strong> This card includes sensitive medical details. Only share, print, or download it when appropriate. The QR code contains your emergency details in readable form. Anyone who scans it can see them. Only print or share it if you are comfortable with that.</p>
    {!profile.fullName && <div className="medical-id-hide-print mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">Your Medical ID is mostly empty. Add your details to your profile first.</p>
      <Button variant="outline" onClick={() => navigate("profile")} className="shrink-0">Edit Medical Profile <ArrowRight size={15} /></Button>
    </div>}
  </div>;
}

function App() {
  const [initialRoute] = useState(() => readRoute(window.location.hash, window.location.pathname));
  const [page, setPage] = useState(initialRoute.page);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [initialProfile] = useState(() => readStored(PROFILE_KEY, {}));
  const [initialPrivate] = useState(() => readStored(PRIVATE_KEY, null));
  const [initialLanguage] = useState(() => readStoredString(LANGUAGE_KEY, "en"));
  const pinConfigured = Boolean(initialPrivate.value?.salt && initialPrivate.value?.iv && initialPrivate.value?.ciphertext);
  const [profile, setProfile] = useState(() => {
    const storedProfile = normalizeProfile(initialProfile.value);
    return pinConfigured ? { ...EMPTY_PROFILE, ...selectFields(storedProfile, EMERGENCY_FIELDS) } : storedProfile;
  });
  const [profileSaved, setProfileSaved] = useState(() => hasProfileData(normalizeProfile(initialProfile.value)));
  const [pinRecord, setPinRecord] = useState(() => pinConfigured ? initialPrivate.value : null);
  const [privateUnlocked, setPrivateUnlocked] = useState(() => !pinConfigured);
  const pinKeyRef = useRef(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [storageError, setStorageError] = useState(() => [initialProfile.error, initialPrivate.error, initialLanguage.error].filter(Boolean).join(" "));
  const [language, setLanguage] = useState(() => initialLanguage.value === "te" ? "te" : "en");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(() => Boolean(navigator.serviceWorker?.controller));
  const [selectedGuide, setSelectedGuide] = useState(initialRoute.guideId);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [emergencyAlert, setEmergencyAlert] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const onLocationChange = () => {
      const route = readRoute(window.location.hash, window.location.pathname);
      if (page === "profile" && route.page !== "profile" && pinRecord) {
        pinKeyRef.current = null;
        setPrivateUnlocked(false);
        setProfile((current) => ({ ...current, ...selectFields(EMPTY_PROFILE, PRIVATE_FIELDS) }));
      }
      setPage(route.page);
      setSelectedGuide(route.guideId);
      setMobileOpen(false);
    };
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
    };
  }, [page, pinRecord]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, chatLoading]);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const updateOfflineStatus = () => setOfflineReady(Boolean(navigator.serviceWorker.controller));
    navigator.serviceWorker.addEventListener("controllerchange", updateOfflineStatus);
    navigator.serviceWorker.ready.then(updateOfflineStatus).catch((error) => {
      console.error("Med Alert offline support could not be activated.", error);
    });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", updateOfflineStatus);
  }, []);

  const activeGuide = useMemo(() => GUIDES.find((guide) => guide.id === selectedGuide), [selectedGuide]);

  function navigate(nextPage) {
    if (page === "profile" && nextPage !== "profile" && pinRecord) {
      pinKeyRef.current = null;
      setPrivateUnlocked(false);
      setProfile((current) => ({ ...current, ...selectFields(EMPTY_PROFILE, PRIVATE_FIELDS) }));
    }
    setPage(nextPage);
    setMobileOpen(false);
    setSelectedGuide(null);
    const destination = nextPage === "profile" ? "/medical-profile" : `/#${nextPage}`;
    window.history.pushState(null, "", destination);
  }

  function openGuide(id) {
    if (!GUIDES.some((guide) => guide.id === id)) {
      navigate("guide");
      return;
    }
    if (page === "profile" && pinRecord) {
      pinKeyRef.current = null;
      setPrivateUnlocked(false);
      setProfile((current) => ({ ...current, ...selectFields(EMPTY_PROFILE, PRIVATE_FIELDS) }));
    }
    setPage("guide");
    setMobileOpen(false);
    setSelectedGuide(id);
    window.history.pushState(null, "", `/#guide/${id}`);
  }

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileMessage("");
    setProfileError("");
  }

  async function persistProfile(value) {
    const completeProfile = normalizeProfile(value);
    if (pinRecord) {
      if (!pinKeyRef.current) throw new Error("Unlock private details before saving this profile.");
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify(selectFields(completeProfile, PRIVATE_FIELDS)));
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, pinKeyRef.current, plaintext);
      const nextRecord = { ...pinRecord, iv: toBase64(iv), ciphertext: toBase64(encrypted) };
      localStorage.setItem(PRIVATE_KEY, JSON.stringify(nextRecord));
      localStorage.setItem(PROFILE_KEY, JSON.stringify(selectFields(completeProfile, EMERGENCY_FIELDS)));
      setPinRecord(nextRecord);
    } else {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(completeProfile));
      localStorage.removeItem(PRIVATE_KEY);
    }
    setProfile(completeProfile);
    setProfileSaved(true);
    setStorageError("");
    setProfileError("");
    setProfileMessage("Medical profile saved on this device.");
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (pinRecord && !privateUnlocked) {
      setProfileError("Unlock private details before saving this profile.");
      return;
    }
    if (!profile.fullName.trim()) {
      setProfileError("Enter the patient's full name before saving.");
      return;
    }
    const today = localDateString();
    if (profile.dateOfBirth && profile.dateOfBirth > today) {
      setProfileError("Date of birth cannot be in the future.");
      return;
    }
    const invalidPhone = [profile.emergencyContactPhone, profile.doctorPhone]
      .some((number) => number.trim() && !phoneUri(number));
    if (invalidPhone) {
      setProfileError("Enter a valid phone number or leave the optional phone field blank.");
      return;
    }
    try {
      await persistProfile(profile);
    } catch (error) {
      setStorageError(error.message || "Could not save to this browser. Check available storage and try again.");
    }
  }

  function clearProfile() {
    try {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(PRIVATE_KEY);
      setProfile({ ...EMPTY_PROFILE });
      setProfileSaved(false);
      setPinRecord(null);
      setPrivateUnlocked(true);
      pinKeyRef.current = null;
      setStorageError("");
      setProfileError("");
      setProfileMessage("Medical profile cleared from this device.");
    } catch {
      setStorageError("Could not clear this browser's saved profile.");
    }
  }

  async function resetDemo() {
    try {
      await persistProfile(DEMO_PROFILE);
      setProfileMessage("Demo profile restored. Replace this sample with your own details.");
    } catch {
      setStorageError("Could not save demo data to this browser. Unlock private details if PIN protection is enabled.");
    }
  }

  async function protectProfile(pin, confirmation) {
    if (pin.length < 4) throw new Error("Choose a PIN with at least 4 characters.");
    if (pin !== confirmation) throw new Error("The PIN entries do not match.");
    if (!window.crypto?.subtle) throw new Error("This browser does not support Web Crypto PIN protection.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derivePinKey(pin, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(selectFields(profile, PRIVATE_FIELDS))),
    );
    const record = { salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(encrypted) };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(selectFields(profile, EMERGENCY_FIELDS)));
      localStorage.setItem(PRIVATE_KEY, JSON.stringify(record));
      pinKeyRef.current = key;
      setPinRecord(record);
      setPrivateUnlocked(true);
      setProfileSaved(true);
      setProfileMessage("Private details are now encrypted on this device.");
    } catch (error) {
      throw new Error(error.message || "Could not save PIN protection to this browser.");
    }
  }

  async function unlockPrivate(pin) {
    if (!pinRecord) return;
    try {
      const key = await derivePinKey(pin, fromBase64(pinRecord.salt));
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(pinRecord.iv) }, key, fromBase64(pinRecord.ciphertext));
      const privateValues = JSON.parse(new TextDecoder().decode(plaintext));
      pinKeyRef.current = key;
      setProfile((current) => ({ ...current, ...selectFields(privateValues, PRIVATE_FIELDS) }));
      setPrivateUnlocked(true);
      setProfileError("");
      setProfileMessage("Private details unlocked for this session.");
    } catch {
      throw new Error("Incorrect PIN or damaged encrypted data. Private details remain locked.");
    }
  }

  async function removePin(pin) {
    if (!pinRecord) return;
    let privateValues;
    try {
      const key = await derivePinKey(pin, fromBase64(pinRecord.salt));
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(pinRecord.iv) }, key, fromBase64(pinRecord.ciphertext));
      privateValues = JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      throw new Error("Incorrect PIN or damaged encrypted data. PIN protection was not removed.");
    }
    const completeProfile = normalizeProfile({ ...profile, ...selectFields(privateValues, PRIVATE_FIELDS) });
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(completeProfile));
      localStorage.removeItem(PRIVATE_KEY);
      setProfile(completeProfile);
      setPinRecord(null);
      setPrivateUnlocked(true);
      pinKeyRef.current = null;
      setProfileMessage("PIN protection removed. All profile details are stored unencrypted on this device.");
    } catch (error) {
      throw new Error(error.message || "Could not remove PIN protection from this browser.");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    setChatInput("");
    setChatError("");
    const isEmergency = EMERGENCY_KEYWORDS.test(message);
    // Show emergency warning immediately, before any API call.
    setEmergencyAlert(isEmergency);
    const nextMessages = [...messages, { role: "user", text: message }];
    setMessages(nextMessages);

    if (!online) {
      const offlineReply = isEmergency
        ? "Call 108 now and follow the emergency dispatcher’s instructions. Stay with the person. This app cannot diagnose or prescribe."
        : "You are offline. If this may be an emergency, call 108. This app cannot diagnose or recommend medicines.";
      setMessages([...nextMessages, { role: "assistant", text: offlineReply }]);
      return;
    }

    setChatLoading(true);
    try {
      // Only the user question and prior pairs are sent. No profile data is attached.
      const response = await fetch("/api/medical-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: nextMessages.slice(0, -1) }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.reply) {
        setChatError(data?.error || "The assistant could not respond. If this is urgent, call 108.");
        setMessages(nextMessages);
      } else {
        setMessages([...nextMessages, { role: "assistant", text: data.reply }]);
        setChatError("");
      }
    } catch (error) {
      const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
      setChatError(isTimeout
        ? "The assistant took too long. If this is urgent, call 108 now."
        : "Could not reach the assistant. Check your connection, or call 108 if this is urgent.");
      setMessages(nextMessages);
    } finally {
      setChatLoading(false);
    }
  }

  function changeLanguage(value) {
    setLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_KEY, JSON.stringify(value));
    } catch {
      setStorageError("Could not save the language choice in this browser.");
    }
  }

  const t = translations[language];
  const offlineLabel = online ? offlineReady ? "Works offline" : "Setting up offline" : "You are offline";
  const content = page === "dashboard" ? <Dashboard profile={profile} profileSaved={profileSaved} navigate={navigate} openGuide={openGuide} /> :
    page === "emergency" ? <Emergency profile={profile} openGuide={openGuide} navigate={navigate} t={t} /> :
    page === "profile" ? <Profile profile={profile} profileSaved={profileSaved} updateProfile={updateProfile} saveProfile={saveProfile} clearProfile={clearProfile} resetDemo={resetDemo} message={profileMessage} error={profileError} pinRecord={pinRecord} privateUnlocked={privateUnlocked} protectProfile={protectProfile} unlockPrivate={unlockPrivate} removePin={removePin} /> :
    page === "hospitals" ? <HospitalDirectory /> :
    page === "medical-id" ? <MedicalId profile={profile} navigate={navigate} /> :
    page === "guide" ? <GuidePage guide={activeGuide} onOpen={(id) => id ? openGuide(id) : navigate("guide")} /> :
    page === "assistant" ? <Assistant messages={messages} input={chatInput} setInput={setChatInput} loading={chatLoading} error={chatError} onSend={sendMessage} onClear={() => { setMessages([]); setChatError(""); setEmergencyAlert(false); }} endRef={chatEndRef} emergencyAlert={emergencyAlert} online={online} /> :
    <Dashboard profile={profile} profileSaved={profileSaved} navigate={navigate} openGuide={openGuide} />;
  const pageKey = page === "guide" ? `guide-${selectedGuide || "index"}` : page;

  return <div className="app-shell">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <button className="flex min-h-11 items-center gap-2.5" onClick={() => navigate("dashboard")} aria-label="Med Alert home">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white shadow-sm"><HeartPulse size={23} strokeWidth={2.4} /></span>
          <span className="text-left text-lg font-extrabold tracking-tight text-ink">med<span className="text-brand">alert</span><span className="ml-1 align-top text-[9px] font-bold uppercase tracking-widest text-slate-400">care</span></span>
        </button>
        <div className="hidden items-center gap-1 xl:flex">
          {NAV_ITEMS.map(({ id, label }) => <button key={id} aria-current={page === id ? "page" : undefined} onClick={() => navigate(id)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${page === id ? "bg-rose-50 text-brand" : "text-slate-500 hover:bg-slate-50 hover:text-ink"}`}>{label}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{offlineLabel}</span>
          <button type="button" onClick={() => changeLanguage(language === "en" ? "te" : "en")} aria-label="Change language" className="min-h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-ink hover:bg-slate-50">{language === "en" ? "తెలుగు" : "English"}</button>
          <button onClick={() => navigate("emergency")} className="hidden items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark xl:inline-flex"><ShieldAlert size={17} /> Emergency Mode</button>
        </div>
        <button aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} className="grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-slate-100 xl:hidden" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </nav>
      {mobileOpen && <div className="border-t border-slate-100 bg-white p-3 xl:hidden">
        <p className="px-3 py-2 text-xs font-semibold text-slate-500">{online ? "Works offline" : "You are offline"}</p>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} aria-current={page === id ? "page" : undefined} onClick={() => navigate(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${page === id ? "bg-rose-50 text-brand" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={18} />{label}</button>)}
        <button onClick={() => navigate("emergency")} className="mt-2 flex w-full items-center gap-3 rounded-xl bg-brand px-3 py-3 text-left text-sm font-bold text-white"><ShieldAlert size={18} />Open Emergency Mode</button>
      </div>}
    </header>

    <main className="mx-auto min-h-[calc(100vh-160px)] max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      {storageError && <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertCircle size={17} />{storageError}</div>}
      <p role="status" className={`mb-4 inline-flex rounded-full px-3 py-1 text-[11px] font-bold sm:hidden ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{offlineLabel}</p>
      <div key={pageKey} className="page-enter">{content}</div>
    </main>
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs leading-5 text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="flex max-w-4xl gap-2"><Shield size={16} className="mt-0.5 shrink-0 text-brand" /><span>{DISCLAIMER}</span></p>
        <span className="shrink-0 font-semibold text-slate-400">Your health. Your information.</span>
      </div>
    </footer>
  </div>;
}

function Dashboard({ profile, profileSaved, navigate, openGuide }) {
  const hasProfile = profileSaved && hasProfileData(profile);
  const quickLinks = [
    { title: "Emergency Guide", text: "Clear steps for common emergencies.", icon: CircleHelp, target: "guide", color: "bg-amber-50 text-amber-600" },
    { title: "Emergency Assistant", text: "Get on-device general safety information.", icon: Bot, target: "assistant", color: "bg-blue-50 text-blue-600" },
    { title: "Medical Profile", text: "Keep your critical details up to date.", icon: ClipboardPlus, target: "profile", color: "bg-emerald-50 text-emerald-600" },
    { title: "Medical ID", text: "Preview, print, download, or share your emergency card.", icon: HeartPulse, target: "medical-id", color: "bg-rose-50 text-brand" },
    { title: "Find Hospitals", text: "Browse hospital addresses and contact details.", icon: Building2, target: "hospitals", color: "bg-indigo-50 text-indigo-600" },
  ];
  return <div className="space-y-10">
    {!hasProfile && <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600"><ClipboardPlus size={19} /></span><div><p className="font-bold text-amber-950">Your medical profile is not set up yet.</p><p className="mt-1 text-sm leading-5 text-amber-800">Add critical details so they’re available in Emergency Mode.</p></div></div>
      <Button variant="outline" onClick={() => navigate("profile")} className="min-h-12 shrink-0 border-amber-200 bg-white text-amber-900 hover:bg-amber-100">Set Up Medical Profile <ArrowRight size={15} /></Button>
    </div>}
    <section className="relative overflow-hidden rounded-3xl bg-white px-6 py-8 shadow-card sm:px-10 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-center lg:gap-8">
      <div className="soft-grid absolute inset-y-0 right-0 hidden w-[43%] opacity-70 lg:block" />
      <div className="relative max-w-2xl">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand"><span className="h-2 w-2 rounded-full bg-brand" />Ready when it matters</p>
        <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">Medical information when every second matters.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-500">Keep critical medical details accessible and get immediate emergency guidance when you need it.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button variant="danger" onClick={() => navigate("emergency")} className="min-h-12 px-5"><ShieldAlert size={18} />Open Emergency Mode <ArrowRight size={16} /></Button>
          <Button variant="outline" onClick={() => navigate("profile")} className="min-h-12 px-5"><Plus size={17} />{hasProfile ? "View / Edit Medical Profile" : "Set Up Medical Profile"}</Button>
        </div>
      </div>
      {hasProfile
        ? <div className="relative mt-8 grid grid-cols-2 gap-3 border-t border-slate-100 pt-6 sm:grid-cols-3 lg:mt-0 lg:grid-cols-2 lg:gap-5 lg:border-0 lg:pt-0">
          <InfoItem label="Name" value={profile.fullName} />
          <InfoItem label="Blood group" value={profile.bloodGroup} />
          <InfoItem label="Allergies" value={profile.allergies} />
          <InfoItem label="Conditions" value={profile.conditions} />
          <InfoItem label="Emergency contact" value={profile.emergencyContactName ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ""}` : ""} />
        </div>
        : <div className="relative mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 lg:mt-0"><p className="font-bold text-ink">Your medical profile is not set up yet.</p><p className="mt-1 text-sm leading-5 text-slate-500">Save your details once and they’ll appear here and on your Medical ID.</p></div>}
    </section>

    <EmergencyContacts />

    <section>
      <div className="mb-4 flex items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">Your essentials</p><h2 className="mt-1 text-xl font-bold text-ink">Medical snapshot</h2></div><button onClick={() => navigate("profile")} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-bold text-brand hover:text-brand-dark">Manage profile <ArrowRight className="ml-1 inline" size={15} /></button></div>
      {hasProfile ? <Card className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="Medical conditions" value={profile.conditions} />
        <InfoItem label="Current medications" value={profile.medications} />
        <InfoItem label="Emergency contact" value={profile.emergencyContactName ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ""}${profile.emergencyContactRelationship ? ` · ${profile.emergencyContactRelationship}` : ""}` : ""} />
        <InfoItem label="Doctor / hospital" value={profile.doctorName ? `${profile.doctorName}${profile.doctorPhone ? ` · ${profile.doctorPhone}` : ""}` : ""} />
      </Card> : <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Medical snapshot details will appear after you set up your profile.</p>}
    </section>

    <section>
      <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">Get prepared</p><h2 className="mt-1 text-xl font-bold text-ink">Quick access</h2></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map(({ title, text, icon: Icon, target, color }) => <button key={target} onClick={() => navigate(target)} className="card-interactive flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-card">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${color}`}><Icon size={22} /></span><span className="min-w-0 flex-1"><span className="block font-bold text-ink">{title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{text}</span></span><ChevronRight className="shrink-0 text-slate-300" size={19} />
        </button>)}
      </div>
    </section>

    <section>
      <div className="mb-4 flex items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">Know what to do</p><h2 className="mt-1 text-xl font-bold text-ink">Common emergencies</h2></div><button onClick={() => navigate("guide")} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-bold text-brand hover:text-brand-dark">All guides <ArrowRight className="ml-1 inline" size={15} /></button></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{QUICK_CARDS.map((card) => {
        const guide = GUIDES.find((item) => item.id === card.guideId);
        const Icon = card.icon;
        return <Card key={card.title} className="card-interactive flex flex-col">
          <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-brand"><Icon size={20} /></span><h3 className="font-bold text-ink">{card.title}</h3><p className="mt-1.5 flex-1 text-sm leading-5 text-slate-500">{card.description}</p>
          <button onClick={() => openGuide(guide.id)} className="mt-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-sm font-bold text-brand">View Guide <ArrowRight size={15} /></button>
        </Card>;
      })}</div>
    </section>
  </div>;
}

function Emergency({ profile, openGuide, navigate, t }) {
  const hasCriticalInfo = [profile.fullName, profile.bloodGroup, profile.allergies, profile.conditions, profile.medications, profile.emergencyContactName, profile.emergencyContactPhone].some((value) => value.trim());
  return <div className="mx-auto max-w-5xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t.fastAccess}</p><h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">{t.emergencyMode}</h1></div><Button variant="outline" onClick={() => navigate("dashboard")}><ChevronRight className="rotate-180" size={17} />{t.backToDashboard}</Button></div>
    {!hasCriticalInfo && <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold leading-5 text-amber-900">{t.noDetails}</p><Button variant="outline" onClick={() => navigate("profile")} className="shrink-0 border-amber-200 bg-white text-amber-900 hover:bg-amber-100">{t.addDetails} <ArrowRight size={15} /></Button></div>}
    <div className="mb-7"><EmergencyContacts t={t} /></div>
    <div className="emergency-panel overflow-hidden rounded-3xl border border-rose-200 bg-white">
      <div className="emergency-critical flex items-center gap-3 px-5 py-4 text-white sm:px-8 sm:py-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><ShieldAlert size={22} /></span><div><p className="font-extrabold tracking-wide">{t.criticalInfo}</p><p className="text-xs text-white/85">{t.shareScreen}</p></div></div>
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b border-slate-100 p-5 sm:border-r sm:px-8 sm:py-7"><InfoItem label={t.fullName} value={profile.fullName} prominent /></div>
        <div className="border-b border-slate-100 p-5 sm:px-8 sm:py-7"><InfoItem label={t.bloodGroup} value={profile.bloodGroup} prominent /></div>
        <div className="border-b border-slate-100 p-5 sm:border-r sm:px-8 sm:py-7 sm:pb-8"><InfoItem label={t.allergies} value={profile.allergies} prominent allergyTags /></div>
        <div className="border-b border-slate-100 p-5 sm:px-8 sm:py-7 sm:pb-8"><InfoItem label={t.conditions} value={profile.conditions} prominent /></div>
        <div className="border-b border-slate-100 p-5 sm:col-span-2 sm:px-8 sm:py-7"><InfoItem label={t.medications} value={profile.medications} prominent /></div>
        <div className="p-5 sm:col-span-2 sm:px-8 sm:py-7"><InfoItem label={t.emergencyContact} value={profile.emergencyContactName ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ""}` : ""} prominent /></div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 p-5 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <a href="tel:108" className="flex min-h-[76px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-center text-sm font-extrabold text-white transition hover:bg-brand-dark sm:col-span-2"><Phone size={19} />{t.emergencyCall}</a>
          <ContactAction number={profile.emergencyContactPhone} label={t.callEmergencyContact} />
        </div>
        <Button variant="outline" onClick={() => openGuide("chest-pain")} className="mt-3 w-full border-slate-200 sm:w-auto"><CircleHelp size={17} />{t.viewGuide} <ChevronDown size={16} /></Button>
      </div>
    </div>
    <div className="mt-8"><NearbyHospitals navigate={navigate} /></div>
    <p className="mt-4 text-center text-xs leading-5 text-slate-500">{t.emergencyWarning}</p>
  </div>;
}

function Profile({ profile, profileSaved, updateProfile, saveProfile, clearProfile, resetDemo, message, error, pinRecord, privateUnlocked, protectProfile, unlockPrivate, removePin }) {
  const today = localDateString();
  const field = (key, props) => <Field {...props} value={profile[key] || ""} onChange={(event) => updateProfile(key, event.target.value)} />;
  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];
  const genders = ["Female", "Male", "Non-binary", "Prefer not to say", "Unknown"];
  const relationships = ["Parent", "Spouse / partner", "Sibling", "Child", "Friend", "Other"];
  const [protectEnabled, setProtectEnabled] = useState(Boolean(pinRecord));
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinError, setPinError] = useState("");
  useEffect(() => { setProtectEnabled(Boolean(pinRecord)); }, [pinRecord]);
  const completenessData = calculateProfileCompleteness(profile);
  const completeCount = completenessData.count;
  const completeness = completenessData.percent;
  async function submitPinSetup() {
    setPinError("");
    try {
      await protectProfile(newPin, confirmPin);
      setProtectEnabled(true);
      setNewPin("");
      setConfirmPin("");
    } catch (pinFailure) {
      setPinError(pinFailure.message);
    }
  }
  async function unlockForm(event) {
    event.preventDefault();
    setPinError("");
    try {
      await unlockPrivate(currentPin);
      setCurrentPin("");
    } catch (pinFailure) {
      setPinError(pinFailure.message);
    }
  }
  async function removeProtection() {
    setPinError("");
    try {
      await removePin(currentPin);
      setProtectEnabled(false);
      setCurrentPin("");
    } catch (pinFailure) {
      setPinError(pinFailure.message);
    }
  }
  function handleSave(event) {
    if (protectEnabled && !pinRecord) {
      event.preventDefault();
      setPinError("Enable PIN protection before saving the profile.");
      return;
    }
    setPinError("");
    saveProfile(event);
  }
  function handleResetDemo() {
    if (protectEnabled && !pinRecord) {
      setPinError("Enable PIN protection before saving the profile.");
      return;
    }
    resetDemo();
  }
  if (pinRecord && !privateUnlocked) {
    return <div className="mx-auto max-w-4xl">
      <SectionTitle eyebrow="Your information" title="Medical Profile" description="Emergency details remain available to responders. Unlock to view private details." action={<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><Shield size={14} />Stored locally</span>} />
      <Card>
        <form onSubmit={unlockForm} className="max-w-md">
          <h2 className="font-bold text-ink">Unlock private details</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Enter your PIN to decrypt your date of birth, doctor details, and private notes on this device.</p>
          <Field label="PIN" type="password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} />
          {pinError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{pinError}</p>}
          <Button type="submit" variant="danger" className="mt-4">Unlock private details</Button>
        </form>
      </Card>
      <p className="mt-4 text-xs leading-5 text-slate-500">Forgotten PINs cannot be recovered. Your encrypted private details would be lost.</p>
    </div>;
  }
  return <div className="mx-auto max-w-4xl">
    <SectionTitle eyebrow="Your information" title="Medical Profile" description="Add and maintain accurate details for quick emergency access." action={<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><Shield size={14} />Stored locally</span>} />
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3"><p className="font-bold text-ink">Profile {completeness}% complete</p><p className="text-xs text-slate-500">{completeCount} of 7 emergency fields</p></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${completeness}%` }} /></div>
    </div>
    <form onSubmit={handleSave}>
      <div className="space-y-4">
        <Card>
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRound size={20} /></span><div><h2 className="font-bold text-ink">Personal Information</h2><p className="mt-0.5 text-xs text-slate-500">Enter the patient's identifying details.</p></div></div>
          <div className="grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2">
            {field("fullName", { label: "Full Name", placeholder: "Patient's full legal name", required: true })}
            {field("dateOfBirth", { label: "Date of Birth", type: "date", max: today })}
            {field("gender", { label: "Gender", placeholder: "Select gender", options: genders })}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-brand"><HeartPulse size={20} /></span><div><h2 className="font-bold text-ink">Emergency Medical Information</h2><p className="mt-0.5 text-xs text-slate-500">Only include accurate, current medical information.</p></div></div>
          <div className="grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2">
            {field("bloodGroup", { label: "Blood Group", placeholder: "Select blood group", options: bloodGroups })}
            <div className="hidden sm:block" />
            <div className="sm:col-span-2">
              {field("allergies", { label: "Allergies", placeholder: "Separate allergies with commas or new lines", rows: 2, disabled: profile.allergies === "None known" })}
              <label className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={profile.allergies === "None known"} onChange={(event) => updateProfile("allergies", event.target.checked ? "None known" : "")} className="h-4 w-4 accent-[#e8414f]" />None known</label>
            </div>
            <div className="sm:col-span-2">
              {field("conditions", { label: "Medical Conditions", placeholder: "Conditions emergency responders should know", rows: 2, disabled: profile.conditions === "None known" })}
              <label className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={profile.conditions === "None known"} onChange={(event) => updateProfile("conditions", event.target.checked ? "None known" : "")} className="h-4 w-4 accent-[#e8414f]" />None known</label>
            </div>
            <div className="sm:col-span-2">
              {field("medications", { label: "Current Medications", placeholder: "List current medications", rows: 2, disabled: profile.medications === "None known" })}
              <label className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={profile.medications === "None known"} onChange={(event) => updateProfile("medications", event.target.checked ? "None known" : "")} className="h-4 w-4 accent-[#e8414f]" />None known</label>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Phone size={20} /></span><div><h2 className="font-bold text-ink">Emergency Contact</h2><p className="mt-0.5 text-xs text-slate-500">A trusted person who can be contacted in an emergency.</p></div></div>
          <div className="grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2">
            {field("emergencyContactName", { label: "Contact Name", placeholder: "Full name" })}
            {field("emergencyContactPhone", { label: "Contact Phone", placeholder: "Phone number", type: "tel", inputMode: "tel" })}
            {field("emergencyContactRelationship", { label: "Relationship", placeholder: "Select relationship", options: relationships })}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ClipboardPlus size={20} /></span><div><h2 className="font-bold text-ink">Doctor Information</h2></div></div>
          <div className="grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2">
            {field("doctorName", { label: "Doctor Name", placeholder: "Doctor or clinic name" })}
            {field("doctorPhone", { label: "Doctor Phone", placeholder: "Phone number", type: "tel", inputMode: "tel" })}
          </div>
        </Card>

        <Card>
          <div className="mb-5"><h2 className="font-bold text-ink">Additional Information</h2></div>
          {field("notes", { label: "Important Medical Notes", placeholder: "Additional information emergency responders should know", rows: 4 })}
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <input id="protect-profile" type="checkbox" checked={protectEnabled} disabled={Boolean(pinRecord)} onChange={(event) => setProtectEnabled(event.target.checked)} className="mt-1 h-4 w-4 accent-[#e8414f]" />
            <div className="min-w-0 flex-1">
              <label htmlFor="protect-profile" className="font-bold text-ink">Protect with PIN</label>
              <p className="mt-1 text-sm leading-5 text-slate-600">Emergency details stay readable on this device. Date of birth, doctor details, and notes are encrypted when a PIN is set.</p>
              {protectEnabled && !pinRecord && <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Create PIN (4+ characters)" type="password" value={newPin} onChange={(event) => setNewPin(event.target.value)} />
                <Field label="Confirm PIN" type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} />
                <Button type="button" variant="danger" onClick={submitPinSetup} className="sm:col-span-2 sm:justify-self-start">Enable PIN protection</Button>
              </div>}
              {pinRecord && <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Current PIN to remove protection" type="password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} />
                <Button type="button" variant="outline" onClick={removeProtection}>Remove PIN</Button>
              </div>}
              <p className="mt-3 text-xs leading-5 text-amber-800">A forgotten PIN cannot be recovered. The encrypted private details would be lost.</p>
            </div>
          </div>
        </Card>
      </div>
      {(error || pinError) && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error || pinError}</p>}
      {message && <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check size={17} />{message}</p>}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="submit" variant="danger" className="min-h-12 w-full px-5 sm:w-auto"><Save size={17} />{profileSaved ? "UPDATE MEDICAL PROFILE" : "SAVE MEDICAL PROFILE"}</Button>
        <Button variant="outline" onClick={clearProfile} className="min-h-12 w-full px-5 sm:w-auto"><X size={17} />CLEAR FORM</Button>
        <Button variant="subtle" onClick={handleResetDemo} className="min-h-12 w-full px-5 sm:ml-auto sm:w-auto">Reset demo data</Button>
      </div>
    </form>
    <p className="mt-4 text-xs leading-5 text-slate-500">Emergency details are stored unencrypted on this device so responders can read them; private details are encrypted if a PIN is set.</p>
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
