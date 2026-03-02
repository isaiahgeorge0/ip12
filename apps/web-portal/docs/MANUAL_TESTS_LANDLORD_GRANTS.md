# Manual tests: Landlord cross-agency visibility (grants)

Use this checklist to confirm behavior after implementing landlord agency grants.

- [ ] **Default scoping**  
  As an admin (non–superAdmin), open a landlord detail page for a landlord in your agency.  
  - Inventory shows only properties under your `session.agencyId`.  
  - Cross-agency visibility section shows “None” or read-only chips; you cannot edit.

- [ ] **Grant enables cross-agency**  
  As superAdmin: add the admin’s agency to the landlord’s grant (`sharedWithAgencyIds`).  
  As that admin: open the same landlord detail page.  
  - Inventory now includes properties from all of the landlord’s agencies (not just the admin’s agency).  
  - No cross-agency leak: remove the admin’s agency from the grant; after refresh, inventory is again only the admin’s agency.

- [ ] **superAdmin can edit grants**  
  As superAdmin on the landlord detail page:  
  - Cross-agency visibility shows an “Edit” button.  
  - Edit opens multi-select of agencies; save updates the grant and the list reflects the new `sharedWithAgencyIds`.

- [ ] **No cross-agency leak without grant**  
  As admin: ensure the landlord has no grant or your agency is not in `sharedWithAgencyIds`.  
  - Inventory shows only properties in your agency.  
  - You cannot see properties from the landlord’s other agencies.

- [ ] **Session and assignment logic unchanged**  
  - Property detail page: assign/unassign still uses `session.agencyId` and works as before.  
  - Landlords list and dropdown remain agency-scoped.  
  - Session cookie and access rules behave as before.

---

# Manual tests: Create ticket from admin property

Use this checklist to confirm the “Create ticket” shortcut from the admin property detail page.

- [ ] **Create ticket from property detail**  
  As an admin, open a property detail page (`/admin/properties/[propertyId]`).  
  - Header shows a “Create ticket” button (next to Edit / Back).  
  - Clicking it opens the create-ticket modal with **property preselected and read-only** (address/postcode shown, no property dropdown).  
  - Fill category, title, description (and optional landlord); submit.  
  - Success: toast “Ticket created” and redirect to `/admin/tickets`.  
  - The new ticket appears in the tickets list and is for the same property.

- [ ] **Ticket audit on create**  
  After creating a ticket (from property detail or from `/admin/tickets`):  
  - Ticket audit entry is written (e.g. `TICKET_CREATED` or equivalent in your audit log).  
  - No regression: creating from the tickets tab still writes the same audit.

- [ ] **Create from tickets tab unchanged**  
  On `/admin/tickets`, click “Create ticket”.  
  - Modal opens **without** a preselected property (property dropdown visible).  
  - Select property, optional landlord, category, title, description; submit.  
  - New ticket appears in the list and the ticket detail modal opens for it.

---

# Manual tests: Cross-agency access rules (view vs mutate)

Use this checklist to confirm consistent cross-agency access and mutation rules.

- [ ] **IP12 admin (primary agency) can assign/unassign**  
  As an admin whose `session.agencyId` is the landlord’s **primary** agency (e.g. IP12):  
  - Open a property detail page for a property in your agency.  
  - Assigned landlords section shows Assign dropdown and Unassign buttons **enabled**.  
  - Assign a landlord and unassign; both succeed.  
  - No “Read-only (cross-agency)” banner.

- [ ] **Woodcock admin (granted) can view landlord + open property detail (read-only)**  
  As superAdmin: add Woodcock to the landlord’s grant (`sharedWithAgencyIds`).  
  As a Woodcock admin:  
  - Open the landlord detail page; it loads (landlord list and detail use member OR grant).  
  - Cross-agency visibility section shows the grant (read-only; no Edit unless superAdmin).  
  - Inventory lists properties from all of the landlord’s agencies.  
  - Click “View property” on a property in another agency (e.g. IP12).  
  - Property detail page loads with URL `?agencyId=...&landlordUid=...`.  
  - Banner shows: “Read-only (cross-agency). You can view this property but cannot edit or change landlord assignments.”  
  - Edit, Create ticket, Assign, and Unassign are **not** shown or are disabled.

- [ ] **Woodcock admin cannot assign/unassign**  
  As Woodcock admin on a property that belongs to the landlord’s **primary** agency (e.g. IP12):  
  - Reached via landlord inventory “View property” (cross-agency view).  
  - Assign and Unassign controls are disabled; helper text indicates only primary agency can change assignments.  
  - Direct POST/DELETE to assign/unassign APIs for that property/landlord return 403.

- [ ] **superAdmin can do everything + audit entries written**  
  As superAdmin:  
  - Open any property detail (with or without `?agencyId=` / `landlordUid=`).  
  - Edit, Create ticket, Assign, Unassign are all available.  
  - Perform an assign or unassign that is a “bypass” (e.g. acting on a landlord whose primary agency is not your session agency).  
  - Audit log contains an entry with `actorRole: superAdmin` and fields: `landlordUid`, `actingAgencyId` or `targetAgencyId`, `landlordPrimaryAgencyId`, `propertyId`, `action` (e.g. PROPERTY_LANDLORD_ASSIGNED / UNASSIGNED).
