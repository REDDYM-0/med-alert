# Med Alert

A responsive emergency medical information dashboard. The medical profile and emergency number are stored only in this browser's local storage. The Gemini API key is used only by the Express backend.

## Requirements

- Node.js 18 or newer
- A Google Gemini API key to use the AI assistant

## Run locally

In one terminal (from the repository root):

```sh
npm install --prefix server
npm run dev --prefix server
```

In another terminal (from the repository root):

```sh
npm install --prefix client
npm run dev --prefix client
```

Open the Vite URL shown in the terminal. The Vite development server proxies `/api` requests to Express on port 3001.

Create `server/.env` from `server/.env.example` and set `GEMINI_API_KEY` to enable the AI assistant. The API returns an explicit configuration error when the key is missing; it does not return a mock response.

Run the API tests from the repository root with:

```sh
npm test --prefix server
```

## Emergency number

Set the local emergency services number in Emergency Mode. The number is saved in this browser and used only for the `tel:` action. Med Alert does not assume a jurisdiction-specific emergency number.

## Medical profile

Open `/medical-profile` to create or update the patient's profile. All profile fields use the single `med-alert-profile` local-storage entry; the Dashboard, Emergency Mode, and Digital Medical ID read from the same profile. Clearing the form removes that saved entry from this browser.

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

The Digital Medical ID is rendered in the browser from the existing Medical Profile in local storage. Print / Save PDF, download, copy, and share actions are user-initiated and do not publish the card to a Med Alert server. The ID includes sensitive health details; review it and share only when appropriate. No QR code is generated.

## Deploy to Vercel

Import this project into Vercel with the repository root as the project root. The root `vercel.json` defines two Vercel Services: the Vite client rooted at `client` and the Express API rooted at `server`. Requests to `/api/*` are routed to the server; all other requests, including `/medical-profile`, go to the client. No service bindings are needed because the client calls the API through same-origin `/api/...` URLs.

Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the Vercel environment for the server. The key is read only by the Express backend and must not be given a `VITE_` prefix.

## Data and medical safety

The medical profile is stored in browser local storage, not sent to the server. Messages sent to the AI assistant are sent to the configured Express backend and Gemini. Do not use this application as a substitute for emergency services or professional medical care.
