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

## Tirupati hospital directory

The Tirupati Hospitals directory is maintained as static local data in `client/src/hospitals.js`. It does not use GPS or a maps API; Directions links open Google Maps using each hospital's name and address. Phone numbers and emergency availability are shown only for facilities with those details recorded in the data file.

## Digital Medical ID

The Digital Medical ID is rendered in the browser from the existing Medical Profile in local storage. Print / Save PDF, download, copy, and share actions are user-initiated and do not publish the card to a Med Alert server. The ID includes sensitive health details; review it and share only when appropriate. No QR code is generated.

## Deploy to Vercel

Import this project into Vercel and configure the project root as the repository root. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in the Vercel project environment variables. The root `vercel.json` builds the Vite client and serves the Express API as a Vercel function on the same origin.

## Data and medical safety

The medical profile is stored in browser local storage, not sent to the server. Messages sent to the AI assistant are sent to the configured Express backend and Gemini. Do not use this application as a substitute for emergency services or professional medical care.
