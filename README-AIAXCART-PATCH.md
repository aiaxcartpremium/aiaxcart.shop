# Aiaxcart Patch (DB + Security + Realtime + Telegram)
> Drop-in files. UI design unchanged.

## What's inside
- **/supabase/supabase_migration.sql** – full schema, triggers (auto-drop), RLS security, RPCs.
- **/supabase/functions/tg-notify/index.ts** – Telegram notifier.
- **/web/js** – replacement/addition JS (data wiring & security):
  - `supabase.js`, `catalog.js`, `orders.js`, `admin-gate.js`, `reports.js`
- **/web/css/extras.css** – logout button style only.
- **/config.private.sample.js** – fill with your project URL/keys.

## How to install (quick)
1. Supabase → SQL → run `supabase_migration.sql`.
2. Storage → create private bucket **reports**.
3. Add yourself to **admin_uids** (copy your `auth.users.id`).
4. Deploy function:
   ```bash
   supabase functions deploy tg-notify --no-verify-jwt
   supabase secrets set BOT_TOKEN=xxx CHAT_ID=yyy
   ```
5. Copy `/web/js/*.js` & `/web/css/extras.css` into your project keeping your HTML/CSS design.
   Add to pages:
   ```html
   <script src="config.private.js"></script>
   <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
   <script src="web/js/supabase.js"></script>
   <!-- your existing scripts ... -->
   ```
   For pages that need data:
   ```html
   <script type="module">
     import { fetchCatalog, fetchOptions, bindRealtime } from "./web/js/catalog.js";
     import { createOrder, confirmPayment } from "./web/js/orders.js";
     import { guardAdmin } from "./web/js/admin-gate.js";
     import { submitReport, leaveFeedback } from "./web/js/reports.js";
     // call these inside your current handlers to populate your existing UI
   </script>
   ```

## Notes
- Feedback now stores **date+time** (`created_at timestamptz`).
- Rules per product show via `product_rules`.
- Stock/Sold auto-update via triggers + views.
- Admin button is hidden for non-admins; DB is still protected by RLS.
