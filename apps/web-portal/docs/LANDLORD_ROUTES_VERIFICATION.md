# Landlord routes UI – manual verification checklist

After deploying or running locally, confirm:

- [ ] Visiting **/landlord/properties** shows the UI (property cards/table with title, postcode, status, agencyId, View link), not JSON.
- [ ] Visiting **/landlord/tickets** shows the UI (ticket list with title, category, status, propertyId, dates, description preview), not JSON.
- [ ] **GET /api/landlord/properties** still returns JSON (e.g. from browser or API client).
- [ ] **GET /api/landlord/tickets** still returns JSON.
- [ ] **/landlord/maintenance** still works and the "Create ticket" flow creates tickets (list appears on /landlord/tickets after creation).
- [ ] Landlord nav links work: Dashboard (/landlord), Properties, Maintenance, Tickets.

Route layout: UI pages live under `src/app/(landlord-protected)/landlord/*`; API routes under `src/app/api/landlord/*` only. No conflict between the two.
