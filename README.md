# Med Alert 2.0

A responsive, privacy-conscious emergency medical information web application (PWA). Profile data is stored only in the browser's local storage; optional PIN protection encrypts private details on the device.

## Requirements

- Node.js 18 or newer
- A modern browser with Web Crypto support for PIN protection
- Groq API key (`GROQ_API_KEY`) for AI Medical Assistant features

## Architecture & Data Flow

- **Frontend**: React + Vite single page application with PWA capabilities.
- **Backend API**: Express.js server providing `/api/medical-assistant` endpoint to interface securely with Groq API (`llama-3.3-70b-versatile`).
- **Privacy & Storage**: 
  - Medical profile data stays in browser `localStorage`.
  - Emergency fields (`fullName`, `bloodGroup`, `allergies`, `conditions`, `medications`, `emergencyContactName`, `emergencyContactPhone`) remain unencrypted for fast access during emergencies.
  - Private fields (`dateOfBirth`, `doctorName`, `doctorPhone`, `notes`, `gender`) can be encrypted using PBKDF2 + AES-GCM when PIN protection is enabled.
  - Profile data is **never** sent to the AI backend or any third-party server.
  - AI Assistant queries contain only the user's chat message and prior conversation turns.

## Run Locally

1. Install dependencies for client and server:
```sh
cd client && npm install
cd ../server && npm install
```

2. Set environment variable:
```sh
# On Windows PowerShell
$env:GROQ_API_KEY="your-groq-api-key"

# On Linux/macOS
export GROQ_API_KEY="your-groq-api-key"
```

3. Start dev servers:
```sh
# Start backend server
npm start --prefix server

# In another terminal, start client
npm run dev --prefix client
```

When `GROQ_API_KEY` is set, online AI assistant queries invoke the backend service. If offline or if the backend is unreachable, the assistant gracefully falls back to local general safety guidance.

## Testing

Run unit test suites for client and server:

```sh
# Run client unit tests
npm test --prefix client

# Run server unit tests
npm test --prefix server
```

## Emergency Number & Guidance

- Emergency Mode defaults to India emergency number **108** (`tel:108`).
- First-aid guidance summaries in `client/src/data.js` cover 8 emergency scenarios (CPR, Choking, Bleeding, Burns, Seizures, Fractures, Heat Stroke, Poisoning).
> **Note**: Guide content is provided for demonstration and general information; content is marked `// Needs verification` and requires formal clinical review prior to medical deployment.

## Multilingual Support

- Supports **English** and **Telugu** (`te`).
- Language selector is accessible from the top navigation bar.
> **Note**: Telugu translations were generated for UI components and require review by a native speaker before production release.

## Locality-Based Medical Facility Directory

Med Alert includes a sample locality-based medical facility directory to display nearby emergency facilities. Location permissions are requested only upon user action (e.g., clicking "Find Nearby Hospitals") and open external Google Maps queries. Med Alert does not record or transmit location data.

## Digital Medical ID

The Digital Medical ID renders a printable card and downloadable QR code. The QR payload includes **only approved emergency fields** and explicitly excludes private fields (`notes`, `dateOfBirth`, `doctorName`, `doctorPhone`, `gender`).

## Deploy to Vercel

Import this repository into Vercel. The included `vercel.json` automatically routes `/api/*` endpoints to the Express serverless function at `api/[...path].js` and all other paths to the Vite SPA build.

Ensure `GROQ_API_KEY` is added to your Vercel Project Environment Variables.

## Medical Safety Disclaimer

Med Alert provides general emergency information and visual medical identification. It does not replace professional medical advice, diagnosis, or emergency services.
