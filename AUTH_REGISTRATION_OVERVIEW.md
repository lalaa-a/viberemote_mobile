# Authentication and registration overview

This document summarizes how user registration and authentication work across the desktop app, mobile app, and server.

## Desktop app (vibe_remote(dekstop)/my-app)

- User registration and sign-in are handled by Supabase Auth using email and password. The Sign Up and Sign In tabs call supabase.auth.signUp and supabase.auth.signInWithPassword.
- The app listens to auth state changes and shows the dashboard only when a valid session exists.
- On first run after sign-in, the dashboard registers the local machine by calling the server endpoint /machines/register with the current Supabase JWT in the Authorization header.
- The desktop app generates a machine ID and a long API key. Only the hash is sent to the server; the raw key is stored locally and written into the relay daemon config.
- The dashboard renders a QR code containing machineId, apiKey, supabaseUrl, and apiUrl for pairing the mobile app.

## Mobile app (vibe_remote(reactNative)/AgentControl)

- The mobile app does not use email/password registration. It authenticates by scanning the QR code shown in the desktop app.
- The QR payload is parsed into machine credentials and verified by calling /mobile/machine on the server.
- When verification succeeds, the machine credentials are stored in MMKV and kept in app state. The root navigator uses the presence of credentials as the auth gate.
- All mobile API calls use the x-machine-api-key header, derived from the stored machine credentials.
- A Supabase client is configured with MMKV storage to persist tokens, but the UI flow relies on QR-based machine credentials rather than Supabase email/password.

## Server (vibe_remote(serverside))

- The server uses a Supabase service key for database access and an anon client only to validate user JWTs.
- requireUserAuth verifies the Authorization Bearer token via Supabase Auth and is used for routes the desktop app calls, such as /machines/register.
- requireMachineAuth verifies x-machine-api-key by hashing it and matching against machines.api_key_hash. This protects /mobile and /relay routes called by the mobile app and relay daemon.
- /machines/register creates the machine record and ties it to the authenticated user.
- /mobile/push-token stores push tokens by user_id and machine_id. notify.js uses those stored tokens to send notifications through Firebase Admin.
- Rate limiting is enabled globally, with a stricter limit on machine registration to reduce abuse.

## Flow summary

1. Desktop user signs up or signs in with Supabase Auth.
2. Desktop app registers the local machine with the server using the Supabase JWT.
3. Desktop app shows a QR code with machine credentials.
4. Mobile app scans the QR code, verifies credentials with the server, and stores them locally.
5. Mobile and relay requests use x-machine-api-key for authentication.

## Registration and authentication call chart

```mermaid
flowchart LR
	subgraph Desktop["Desktop app"]
		DU[User]
		DA[Auth UI: handleSubmit()]
		DS[Supabase Auth: signUp/signInWithPassword]
		DG[App session: getSession() + onAuthStateChange()]
		DD[Dashboard: registerMachine()]
		DQ[QR payload: machineId, apiKey, apiUrl]
		DU --> DA --> DS --> DG --> DD --> DQ
	end

	subgraph Server["Server API"]
		SR[POST /machines/register]
		SUser[requireUserAuth() -> Supabase getUser()]
		SDB[Insert machine with api_key_hash]
		SM[GET /mobile/machine]
		SMAuth[requireMachineAuth() -> hash api key + lookup]
		SR --> SUser --> SDB
		SM --> SMAuth
	end

	subgraph Mobile["Mobile app"]
		MU[User]
		MS[QRScanScreen: onCodeScanned()]
		MV[verifyCredentials()]
		MSave[saveCredentials() + setCredentials()]
		MGuard[RootNavigator auth guard]
		MU --> MS --> MV --> SM --> MSave --> MGuard
	end

	DD -- Authorization Bearer JWT --> SR
	MV -- x-machine-api-key --> SM
```

## File and function map

### Desktop app (outside this workspace)

- src/components/Auth.jsx: `Auth` component `handleSubmit()` calls `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`.
- src/App.jsx: `App` component calls `supabase.auth.getSession()` and subscribes to `supabase.auth.onAuthStateChange()` to gate the UI.
- src/components/Dashboard.jsx: `registerMachine()` calls `POST /machines/register` with `Authorization: Bearer <JWT>` and builds the QR payload.

### Mobile app (in this workspace)

- [AgentControl/src/screens/Auth/QRScanScreen.tsx](AgentControl/src/screens/Auth/QRScanScreen.tsx): `QRScanScreen()` -> `onCodeScanned()` -> `verifyCredentials()` -> `saveCredentials()` -> `setCredentials()`.
- [AgentControl/src/api/server.ts](AgentControl/src/api/server.ts): `verifyCredentials()` calls `GET /mobile/machine` with `x-machine-api-key`.
- [AgentControl/src/store/useAppStore.ts](AgentControl/src/store/useAppStore.ts): `credentials` initializes from `getCredentials()`.
- [AgentControl/src/hooks/useAuth.ts](AgentControl/src/hooks/useAuth.ts): `useAuth()` exposes `credentials` and `signOut()`.
- [AgentControl/src/navigation/RootNavigator.tsx](AgentControl/src/navigation/RootNavigator.tsx): auth guard switches between `QRScanScreen` and app tabs.

### Server (outside this workspace)

- src/middleware/auth.js: `requireUserAuth()` validates Supabase JWT, `requireMachineAuth()` validates `x-machine-api-key`.
- src/routes/machines.js: `POST /machines/register` uses `requireUserAuth()` and inserts machine row with `api_key_hash`.
- src/routes/mobile.js: `GET /mobile/machine` uses `requireMachineAuth()` to verify QR-scanned credentials.
