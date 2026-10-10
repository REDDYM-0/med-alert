# Med Alert

A responsive emergency medical information dashboard. Profile data is stored only in this browser's local storage; optional PIN protection encrypts private details on this device. The app does not send profile or assistant messages to a server.

## Requirements

- Node.js 18 or newer
- A modern browser with Web Crypto support for optional PIN protection

## Run locally

From the repository root:

```sh
npm install --prefix client
npm run dev --prefix client
```

Open the Vite URL shown in the terminal. Assistant responses are local general safety guidance; no assistant API request is made.

## Emergency number

Emergency Mode uses the India emergency number 108 (`tel:108`).

## Medical profile

Open `/medical-profile` to create or update the patient's profile. Emergency details remain readable in local storage for responders; date of birth, doctor details, and notes can be encrypted with a PIN. Forgotten PINs cannot be recovered. The Dashboard, Emergency Mode, and Digital Medical ID use emergency details saved on this device.

## Locality-Based Medical Facility Directory

Med Alert includes a locality-based medical facility directory designed to help users find relevant hospitals, clinics, and other medical facilities according to their selected or available locality context.

The current MVP contains a limited set of sample facility information for demonstration purposes. The feature is not restricted to any single city or locality. As the project is expanded, facility information can be added for different locations so that users can access relevant medical resources based on their locality.

The directory can provide useful information such as:

- Medical facility name
- Facility type
- Address or locality
- Contact information, where available
- Navigation or map access
- Emergency-related information, where available

The current sample dataset should be treated as demonstration data rather than a complete or continuously updated medical-facility directory.

## Digital Medical ID

The Digital Medical ID and QR code are generated in the browser. The QR code contains only emergency fields in readable form. Print / Save PDF, download, copy, and share actions are user-initiated; anyone scanning a printed or shared QR can read those details.

## Deploy to Vercel

Import this project into Vercel with the repository root as the project root. The root `vercel.json` serves only the Vite client; no server, API key, or service binding is required.

## Data and medical safety

Emergency information is stored unencrypted in browser local storage so it can be read without a PIN. Private details are encrypted with PBKDF2 and AES-GCM when PIN protection is enabled. Assistant messages stay on-device. Location is requested only after tapping the nearest-hospital action and is used to open a Google Maps search; Med Alert does not save it. Do not use this application as a substitute for emergency services or professional medical care.
