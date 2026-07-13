# Sheet-to-Netlify build automation

This optional companion automation keeps the generated offering and sponsor pages current when the Master Listings Sheet changes. It is separate from the website build itself: GitHub pushes still deploy normally, while this script asks Netlify to run the same build after a Sheet edit or during the nightly safety run.

## One-time setup

1. In Netlify, open the Baker 1031 site and create a build hook under **Project configuration → Build & deploy → Build hooks**. Use a name such as `sheet-update` and copy the URL.
2. In the Master Listings Sheet, open **Extensions → Apps Script** and add `sheet-trigger.gs` and `appsscript.json` from this folder.
3. In Apps Script **Project Settings → Script properties**, add `NETLIFY_BUILD_HOOK` and paste the build-hook URL as its value. Do not put the URL in GitHub or in a public document.
4. Run `setupTriggers()` once and grant the requested permissions.

After setup, edits are debounced for roughly five minutes and the script runs one nightly rebuild around 6:00 a.m. Pacific. The script only manages its own three trigger names and leaves unrelated Apps Script automations alone.

## Attio People -> Google Contacts sync

`attio-contacts-sync.gs` adds a free, one-way sync without Zapier. The normal
path is **Attio V2 webhook -> existing Netlify Function -> this Apps Script
web app -> Google People API**. New Attio People records are looked up by email
before a Google Contact is created, so retries and existing Google Contacts do
not normally create duplicates.

### One-time setup

1. In the same Apps Script project, add `attio-contacts-sync.gs`.
2. In **Project Settings -> Script properties**, add:
   - `ATTIO_CONTACT_SYNC_SECRET`: a long random value used only in the webhook URL.
   - `ATTIO_API_TOKEN`: only needed if you use the direct/native Apps Script
     webhook fallback described below. The recommended Netlify relay uses the
     existing Netlify `ATTIO_API_TOKEN` instead.
3. In the Apps Script manifest, add these OAuth scopes to the existing scope list
   (merge them; do not replace scopes used by the Sheet trigger):

   ```json
   "https://www.googleapis.com/auth/contacts",
   "https://www.googleapis.com/auth/script.external_request"
   ```

4. In the Apps Script project's linked Google Cloud project, enable **People API**.
5. Run `authorizeContactSync()` once from the Apps Script editor and approve the
   Google Contacts permission.
6. Deploy the project as a **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy the `/exec` URL.
7. Add these Netlify environment variables to the Baker 1031 site:
   - `ATTIO_CONTACT_WEBHOOK_SECRET`: the secret generated for the Attio V2 webhook.
   - `GOOGLE_CONTACTS_SYNC_WEBHOOK_URL`: the Apps Script `/exec` URL with the
     `?key=YOUR_SECRET` query parameter.
   - `ATTIO_PEOPLE_OBJECT_ID`: optional; set it to the People object ID to
     filter at the relay before it fetches records.
8. In Attio, open **Developer settings -> Webhooks**, create a V2 webhook for
   `record.created`, and set the target URL to:

   ```text
   https://baker1031.com/.netlify/functions/attio-google-contact-sync
   ```

   Attio signs the request, and the Netlify relay verifies the signature before
   reading the Person record.
9. Send Attio's test event, then create one test Person with an email address.

The script deliberately does not write a new Attio attribute for the Google
resource ID, because existing Baker 1031 code depends on the current Attio
field schema. Its private mapping is kept in Apps Script Script Properties.

### Direct Attio Workflow alternative

If you prefer not to create an Attio webhook, use an Attio Workflow with
**Record created -> People -> Send HTTP request** and send a JSON body
containing `email`, `givenName`, `familyName`, `phone`, `company`, and
`jobTitle` directly to the Apps Script URL with the `?key=YOUR_SECRET` query
parameter. The Apps Script handler accepts that direct payload as well.

## Security

Treat the Netlify build-hook URL like a password. If it is exposed, delete it in Netlify, create a replacement, and update the `NETLIFY_BUILD_HOOK` Script property.

Treat the Apps Script deployment URL and both Script Properties as secrets. If
the webhook URL is exposed, rotate `ATTIO_CONTACT_SYNC_SECRET` and update the
Attio webhook target. Do not commit either secret to this repository.
