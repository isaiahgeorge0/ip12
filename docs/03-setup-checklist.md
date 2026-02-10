# Setup checklist

Use this checklist when setting up a new environment or onboarding.

## Firebase project setup

- [ ] Create Firebase project (or use existing)
- [ ] Enable Authentication (e.g. Email/Password, optionally Google/Apple)
- [ ] Create Firestore database and choose region
- [ ] Enable Cloud Functions (Blaze plan if using Functions)

## App registration

- [ ] **Web** — Register web app in Firebase Console; note config for `apps/web-portal`
- [ ] **iOS** — Register iOS app; add `GoogleService-Info.plist` to `apps/tenant-mobile`
- [ ] **Android** — Register Android app; add `google-services.json` to `apps/tenant-mobile`

## Environment variables

- [ ] Define required env vars for `apps/web-portal` (e.g. `.env.local`)
- [ ] Define required env vars / secrets for `backend/firebase-functions`
- [ ] Document all keys in `docs` (values only in secure storage / CI secrets)

## Security rules

- [ ] Write and deploy Firestore Security Rules
- [ ] Review Cloud Functions for authorization and input validation
- [ ] Restrict Firebase config and API keys to allowed origins/apps
