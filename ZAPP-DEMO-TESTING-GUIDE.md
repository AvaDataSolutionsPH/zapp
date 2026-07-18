# ZAPP Donuts ERP — Complete Demo Testing Guide

> **Para saan ito:** Systematic, step-by-step na walkthrough para ma-verify mo ang lahat ng feature bago at habang nagde-demo. Naka-organize per role (block-by-block). May kasamang eksaktong mock data na ico-copy-paste mo sa mga form.
>
> **Live URL:** https://zapp-erp.vercel.app
> **Lahat ng account, password:** `111111`
> **Petsa ngayon (demo):** Hunyo 2026 — lampas na sa Marso 2026 cutoffs (importante, basahin ang "Mga Dapat Tandaan" sa baba).

---

## ⚠️ MGA DAPAT TANDAAN BAGO MAG-DEMO (basahin muna ito)

1. **Para ipakita ang per-role na pananaw → gamitin ang LOGIN (logout → login), HINDI ang Role dropdown sa taas.**
   Ang "Switch Demo Role" dropdown sa TopBar ay **preview-only** na ngayon — pinapalitan lang nito ang pangalan/role sa screen pero **hindi** ang aktwal na database scope. Para totoong maipakita na "iba-iba ang nakikita ng bawat role," kailangan mo talagang mag-**logout** at mag-**login** gamit ang ibang account.

2. **Karamihan ng stores ay nasa WARNING o HOLD status sa first load — NORMAL ito, hindi bug.**
   Ang demo date (Hunyo 2026) ay lampas na sa Marso 2026 mock billing cutoffs, kaya naka-trigger ang auto-HOLD enforcement rule sa overdue billing. Kapag tinanong: *"Yan ang automatic delivery-enforcement feature — nag-fi-flag ng stores na may overdue billing."* (0 overdue = ACTIVE, 1 = WARNING, 2+ = HOLD.)

3. **⚠️ DATA INCONSISTENCY na dapat mong I-AVOID sa demo:**
   Ang **bagong product catalog** ay 9 na totoong produkto (Chocolate Zprinkles, Choco Butternut, Bavarian, atbp.). PERO ang ilang **lumang sample records** (Ending Inventory at Special Orders na naka-seed) ay may LUMANG product names pa (hal. "Classic Glazed", "Red Velvet", "Matcha Glazed") na wala na sa catalog.
   - **Iwasan:** Huwag i-feature ang detalye ng mga lumang seeded Special Order / Ending Inventory na may kakaibang product name.
   - **I-feature sa halip:** Gumawa ka ng **BAGONG** Ending Inventory / Special Order **live** sa demo — gagamitin nito ang tamang 9-product catalog.

4. **Para sa OCR demo (DR slip scanning):** maghanda ng isang **tunay na larawan ng DR slip** o malinaw na donut-crate photo bago mag-demo. Ang naka-seed na data ay gumagamit ng placeholder image paths, kaya kailangan mo ng totoong upload para gumana ang live OCR/crate-counting.

---

## 📋 REFERENCE: Demo Accounts (lahat password `111111`)

| Email | Role | Ano nakikita / scope |
|---|---|---|
| `alfonso@zappdonuts.com` | **Owner** | Lahat — buong business, admin, referral codes |
| `diana@zappdonuts.com` | **Operations Manager** | Deliveries, inventory, AI validation, applications |
| `gabriel@zappdonuts.com` | **Forecaster** | Forecasting (naka-filter sa plant-02) |
| `helen@zappdonuts.com` | **Plant Manager** | plant-01 (Daraga) — stores/deliveries/billing ng plant |
| `ivan@zappdonuts.com` | **Billing User** | Billing records, payment verification |
| `marco@zappdonuts.com` | **Partner Distributor** | dist-01 Bicol — kanyang network ng stores |
| `ricardo@zappdonuts.com` | **Partner Distributor** | dist-03 Manila — kanyang network |
| `mariel@zappdonuts.com` | **Sub-Partner Distributor** | spd-01 — VIEW-ONLY, stores 02 & 04 |
| `patricia@zappdonuts.com` | **Area Supervisor** | am-01 — stores 01, 02, 03, 05 |
| `legazpi.centro@zappdonuts.com` | **Franchisee (Distributor)** | store-01 lang (Maria Santos) |
| `legazpi.port@zappdonuts.com` | **Franchisee (Direct)** | store-03 lang (Ana Lim) |

---

## 📦 REFERENCE: Tunay na Product Catalog (9 produkto)

Gamitin ang mga ito sa Special Order / forms. ID = 10-digit SAP code (yan ang nasa tunay na DR slip).

| SKU Code | Produkto | Category | DR Price | SRP |
|---|---|---|---|---|
| 2000017949 | Chocolate Zprinkles | Premium | ₱20.44 | ₱28 |
| 2000015696 | Zapp Its! Choco Butternut | Classic | ₱6.56 | ₱9 |
| 2000015695 | Choco Butternut | Classic | ₱20.44 | ₱28 |
| 2000000519 | Zapp Its! | Classic | ₱6.56 | ₱9 |
| 2000000538 | Bavarian - Classic | Filled | ₱18.24 | ₱25 |
| 2000000520 | Bavarian - Choco | Filled | ₱18.24 | ₱25 |
| 2000000521 | Strawberry Zprinkles | Filled | ₱18.24 | ₱25 |
| 2000020575 | Dobol Bav - Classic, Chocolate | Premium | ₱21.00 | ₱28 |
| 2000020576 | Dobol Bav - Classic, Strawberry | Premium | ₱21.00 | ₱28 |

---

## 🏪 REFERENCE: Key Stores at Distributors

| ID | Store | Distributor | Area Supervisor | Type |
|---|---|---|---|---|
| store-01 | ZAPP Legazpi Centro | dist-01 Bicol Express | Patricia (am-01) | Franchisee-Distributor |
| store-02 | ZAPP Daraga Market | dist-01 + **SPD spd-01** | Patricia (am-01) | Franchisee-Distributor |
| store-03 | ZAPP Legazpi Port | (direct) | Patricia (am-01) | Franchisee-Direct |
| store-04 | ZAPP Tabaco Plaza | dist-01 + **SPD spd-01** | Daniel (am-02) | Franchisee-Distributor |
| store-09 | ZAPP Tondo Main | dist-03 Metro Manila | Bryan (am-04) | Franchisee-Distributor |
| store-12 | ZAPP Makati Ayala | dist-03 Metro Manila | Janine (am-05) | Franchisee-Distributor |

**Referral codes (para sa /apply):** `BICOL-MARCO` (dist-01), `METRO-RICK` (dist-03), `ZAPP-INT-001` (internal).

---

# 🧪 TEST BLOCKS

> Sundin nang sunod-sunod. Bawat block ay isang role o isang feature. Tsek (✅) kapag pasado.

---

## BLOCK A — Owner: Buong Visibility + Admin
**Login:** `alfonso@zappdonuts.com` / `111111`

1. Mag-login. Dapat lumabas ang **Owner Dashboard** na may 4 KPI cards: Total DR Sales, Total SRP Sales, Avg Sales/Store, Total Active Stores.
2. I-verify na may lumalabas na charts: SRP Sales Trend (line), Sales by Plant (bar), Province Contribution (donut), **Distributor Ranking table**.
3. Sa sidebar, i-verify na **NAKIKITA LAHAT** ng sections: Overview, Operations, Finance, Analytics, **Admin** (Referral Codes + Settings).
4. Buksan ang **Stores** (sidebar → "Stores"). Dapat ~24–26 stores ang lumabas. I-click ang isang row → dapat pumunta sa store detail (HINDI bumalik sa public home — dati may bug dito, fixed na).
5. Buksan ang **Distributors** — dapat 5 PDs (Bicol Express, CamSur, Metro Manila, QC Wholesale, Visayas Trade).
6. Buksan ang **Referral Codes** (Admin). Dapat may listahan ng codes (BICOL-MARCO, METRO-RICK, atbp.).
7. **(Optional) Gumawa ng bagong referral code:** "Generate New Code" → Type: Distributor → piliin ang isang distributor → piliin ang Plant → "Create Code". Dapat may toast na "Referral code … created" at lalabas sa table.
8. Buksan ang **Analytics**, **Leaderboards**, **Geo Heatmap** — dapat lahat may laman (charts/map).

✅ **Pass kung:** lahat ng sidebar visible, dashboards may laman, stores clickable papuntang detail, admin pages gumagana.

---

## BLOCK B — Public Application Flow (/apply) + Approval
**Walang login muna (public).** Pumunta sa https://zapp-erp.vercel.app/apply

**Copy-paste values:**
```
Referral Code:    BICOL-MARCO
Full Name:        Juan Dela Cruz
Mobile Number:    09171234567
Email Address:    juan.test@example.com
Store Name:       ZAPP Demo Test Store
Complete Address: 123 Rizal St, Brgy Centro, Legazpi City
Province:         Albay
City / Area:      Legazpi City
Latitude:         13.1391   (optional)
Longitude:        123.7341  (optional)
```

1. Ilagay ang **Referral Code** = `BICOL-MARCO`, i-click **Validate**. Dapat lumabas ang green card (Distributor: Bicol Express, Plant, atbp.).
2. Punan ang Personal Info (gamitin ang values sa itaas). Subukan munang maling phone (hal. `12345`) → dapat may error na "Enter a valid PH mobile number". Tapos ayusin.
3. Punan ang Store Info (Store Name, Address, Province=Albay, City=Legazpi City).
4. **Upload 3 files:** Store Photo, Government ID, Proof of Billing (kahit anong test image/PDF). Lahat required.
5. Sa Review step, i-check ang **Data Privacy Consent** checkbox → **Submit Application**.
6. Dapat lumabas ang **"Application Submitted!"** modal na may reference code.
7. **Ngayon i-approve:** Logout (kung naka-login) → login bilang Owner (`alfonso@zappdonuts.com`) → **Applications** → hanapin ang "ZAPP Demo Test Store" (status: pending).
8. I-click ang row → **Application Detail** → i-click **Approve** → (optional reviewer note) → confirm. Dapat may toast: "Application … approved — store created."
9. I-verify sa **Stores** na may bagong "ZAPP Demo Test Store".

✅ **Pass kung:** validation gumagana, files nag-upload, application submitted, approval gumawa ng bagong store.

---

## BLOCK C — Franchisee: Beginning + Ending Inventory
**Login:** `legazpi.centro@zappdonuts.com` / `111111` (Maria Santos, store-01)

1. Mag-login. Dapat **Franchisee Dashboard** (Today's Sales, This Week, Unsold Today, Payment Status). Tandaan: store-01 lang ang makikita niya.
2. Sidebar dapat **limited** lang: Dashboard, Stores, Deliveries, Beginning Inventory, Ending Inventory, Packaging, Special Orders, Billing, Payments. **Walang** Applications/Distributors/Admin.

**Beginning Inventory:**
3. **Beginning Inventory** → piliin ang isang delivery na status = "delivered".
4. Step 1: Upload DR image (gamitin ang tunay na DR slip photo para sa OCR demo). Step 2: Upload crate images.
5. Step 3: i-click "Process with AI" → dapat lumabas ang OCR results table (extracted quantities + confidence).
6. Step 4: i-confirm/edit ang quantities. Step 5: i-click "Submit Beginning Inventory" → confirm. Toast: "Beginning inventory submitted."

**Ending Inventory:**
7. **Ending Inventory** → piliin ang isang delivery (status delivered/reconciled).
8. Ilagay ang **Unsold** quantities per SKU (hal. 3, 5, 2). Awto na ang "Sold" computation.
9. (Optional) Upload end-of-day crate photos + "Process with AI".
10. I-click **Save Ending Inventory** → confirm. Toast: "Ending inventory submitted for review."
11. I-verify sa **Submission History** table (nasa baba ng page) na lumabas ang bagong EI na status = **pending_review**.

✅ **Pass kung:** franchisee limited ang sidebar, BI/EI submit gumagana, EI napunta sa pending_review.

> 💡 Ang EI na ginawa mo dito ang i-review mo sa **Block D**.

---

## BLOCK D — Reviewer: Ending Inventory State Machine
**Login:** `marco@zappdonuts.com` / `111111` (PD, dist-01) — o `patricia@zappdonuts.com` (Area Supervisor)

> Ang EI review state machine: **pending_review → (Approve / Needs Review / Request Correction) → resubmit → pending_review → approved** (terminal).

1. Mag-login bilang PD. Sidebar dapat may **Inventory Reviews**. Buksan ito.
2. May 4 status tabs: Pending Review / Needs Review / Correction Required / Approved. Buksan ang **Pending Review** tab.
3. I-click ang EI mula sa Block C (o `ei-01` store-01 / `ei-05` store-03). Magbubukas ang **detail drawer** na may financial preview + per-SKU breakdown.

**Test ang 3 actions (gumamit ng magkakaibang EI para makita lahat):**

4. **Approve:** i-click **Approve** → confirm dialog (sasabihin "final, cannot be reverted") → confirm. Toast: "Approved: … reconciled." Status → approved. **(Ito ang nag-fi-feed sa billing.)**
5. **Needs Review:** sa ibang EI, i-click **Mark Needs Review** → ilagay comment: `Pakipa-clarify ang unsold count sa Bavarian — mukhang mataas.` → "Send to Store". Toast: "Store notified for clarification."
6. **Request Correction:** sa ibang EI, i-click **Request Correction** → baguhin ang "Correct" qty sa isa o dalawang SKU → ilagay reason: `Physical recount shows different figures.` → "Send Corrections". Toast: "… correction(s) sent to store."
7. **(Optional) I-verify ang loop:** logout → login bilang franchisee (`legazpi.centro@zappdonuts.com`) → Ending Inventory → Submission History → ang EI na "correction_required" ay may **Resubmit** button → ayusin ang qty → resubmit → babalik sa pending_review.

✅ **Pass kung:** lahat ng 3 review actions gumagana, may notifications, status transitions tama, approved feeds billing.

---

## BLOCK E — Billing User: Verify Payment
**Login:** `ivan@zappdonuts.com` / `111111`

1. Mag-login. Dapat **Billing Dashboard** (Total Payable, Paid, Overdue Count, Pending Payments).
2. Sidebar dapat: Dashboard, Special Orders, Billing, Payments. (Limited.)
3. Buksan ang **Payments**. Hanapin ang payment na status = **submitted** (hal. `pay-07` store-04, ref `GCASH-20260318-9912`, ₱11,850).
4. I-click ang row → magbubukas ang **Verify modal**. I-check ang amount-match badge ("Matches" / "Mismatch").
5. Kung may payment proof (manual), i-click ang image tile → dapat mag-expand ang larawan (signed URL — pinatunayan na gumagana ito).
6. I-click **Verify Payment**. Toast: "Payment from … verified. Billing marked paid."
7. **(Optional) Test reject:** sa ibang submitted payment, i-click **Reject** → ilagay reason → "Confirm Rejection". Toast: "… rejected."

✅ **Pass kung:** verify modal nagbubukas, payment proof image nagre-render, verify/reject gumagana.

---

## BLOCK F — Franchisee: Submit Payment
**Login:** `legazpi.centro@zappdonuts.com` / `111111`

1. Buksan ang **Billing** o **Payments** → hanapin ang button para mag-submit ng payment (Submit Payment modal).
2. Piliin ang **billing record** (auto-fill ang Amount = total payable — kailangan EKSAKTO ang amount).
3. Piliin ang **Payment Method**:
   - **Manual Upload:** mag-upload ng proof image → Reference Number: `BDO-20260601-1234` → Date Paid: ngayon.
   - **Payment Gateway:** Card `4242 4242 4242 4242`, Expiry `12/27`, CVV `123` (simulated, walang totoong charge).
4. I-submit. Toast: "Payment submitted/processed. Awaiting billing verification."

✅ **Pass kung:** amount-match validation gumagana, submit nagti-toast, status → submitted (makikita sa Block E para i-verify).

---

## BLOCK G — Packaging Order
**Login:** `legazpi.centro@zappdonuts.com` / `111111` (o Owner / Plant Manager)

1. Buksan ang **Packaging** (sidebar).
2. Sa Catalog tab, mag-search/mag-filter ng packaging items. I-click **Add** sa 2–3 items.
3. Ayusin ang quantities sa cart (gamitin ang +/− controls).
4. I-click **Submit Order**. Toast: "Packaging order submitted…".
5. Buksan ang **Order History** tab → dapat lumabas ang bagong order.

✅ **Pass kung:** cart gumagana, submit nagti-toast, order lumabas sa history.

---

## BLOCK H — Special Order (gumamit ng TAMANG catalog)
**Login:** `diana@zappdonuts.com` / `111111` (Operations) o Owner

1. Buksan ang **Special Orders** → "New Special Order".
2. Punan:
   ```
   Store:  ZAPP Legazpi Centro (store-01)
   Date:   (ngayon)
   Item 1: Chocolate Zprinkles (2000017949) — Qty 100
   Item 2: Bavarian - Classic (2000000538) — Qty 50
   Notes:  Demo bulk order for corporate event
   ```
3. I-verify ang **Order Preview** (DR Total + SRP Total na auto-compute).
4. I-click **Create Special Order**. Toast: "Special order recorded. SRP total: ₱…".
5. I-verify sa history table.

✅ **Pass kung:** SKU dropdown may TAMANG 9 products, totals tama, submit gumagana.

---

## BLOCK I — Forecaster: Save Forecast
**Login:** `gabriel@zappdonuts.com` / `111111`

1. Mag-login. Dapat **Forecaster Dashboard** (Forecast Accuracy, Total Forecasts, HOT/WEAK Demand stores).
2. Sidebar limited: Dashboard, Forecasting, Analytics.
3. Buksan ang **Forecasting** → piliin ang isang store.
4. Tingnan ang forecast table: Avg 14-Day Sales, Demand Pressure (HOT/NORMAL/WEAK), Recommended qty.
5. I-edit ang ilang "Your Forecast" values → i-click **Save**. Toast: "Forecast has been submitted successfully."

✅ **Pass kung:** forecast table may laman, edit + save gumagana.

---

## BLOCK J — Partner Distributor: Role-Scoped View + Leaderboard
**Login:** `marco@zappdonuts.com` / `111111` (dist-01 Bicol)

1. Mag-login. Dapat **Distributor Dashboard**: My Stores, Total SRP Sales, Total Remittance (85%), Total Collected.
2. I-verify na **Bicol/dist-01 stores LANG** ang nakikita (store-01, 02, 04, atbp.) — **HINDI** ang Manila/Cebu stores. (Ito ang patunay ng RLS scoping.)
3. Tingnan ang **Leaderboard Position** badge (rank out of X distributors) at **My Stores Performance** table.
4. Buksan ang **Franchisees** — dapat ang kanyang network lang.
5. **(Cross-check) Logout → login bilang `ricardo@zappdonuts.com` (dist-03 Manila)** → dapat **IBANG** stores (Manila/NCR) ang lumabas, hindi Bicol. **Ito ang pinaka-malinaw na demo ng per-role data scoping.**

✅ **Pass kung:** PD nakikita LANG ang sariling network; ibang PD = ibang stores.

---

## BLOCK K — Sub-Partner Distributor: VIEW-ONLY
**Login:** `mariel@zappdonuts.com` / `111111` (spd-01)

1. Mag-login. Dapat **read-only SPD Dashboard**: My Stores, Total SRP, Total DR, **My Share (5% of Gross / 50% of PD Profit)**.
2. May info box tungkol sa parent PD (Bicol Express) at explanation ng share.
3. I-verify na **store-02 (Daraga) at store-04 (Tabaco) LANG** ang nakikita.
4. I-verify na **WALANG** action buttons / review queue / edit — view-only talaga.

✅ **Pass kung:** read-only, tama ang 2 assigned stores, may share computation, walang aksyon.

---

## BLOCK L — Final Role-Scope Sweep (RLS Verification)
Mabilis na pag-ikot para patunayan na iba-iba talaga ang nakikita per role. **Logout → login** bawat isa.

| Login | I-verify |
|---|---|
| `helen@zappdonuts.com` (Plant Mgr) | plant-01 (Daraga) stores/deliveries LANG; may Plant Manager dashboard |
| `patricia@zappdonuts.com` (Area Supervisor) | stores 01, 02, 03, 05 lang; may Inventory Reviews access |
| `legazpi.port@zappdonuts.com` (Franchisee-Direct) | store-03 LANG; limited sidebar |
| `diana@zappdonuts.com` (Operations) | deliveries/inventory/AI/applications; WALANG admin |

✅ **Pass kung:** bawat role iba ang scope; walang nakakakita ng data na hindi para sa kanila.

---

# ✅ SIGN-OFF CHECKLIST

- [ ] Block A — Owner full visibility + admin
- [ ] Block B — /apply submission + approval → store created
- [ ] Block C — Franchisee Beginning + Ending Inventory
- [ ] Block D — EI review (Approve / Needs Review / Correction)
- [ ] Block E — Billing verify payment + proof image renders
- [ ] Block F — Franchisee submit payment (manual + gateway)
- [ ] Block G — Packaging order
- [ ] Block H — Special order (tamang 9-product catalog)
- [ ] Block I — Forecaster save forecast
- [ ] Block J — PD role-scoped view + leaderboard
- [ ] Block K — SPD view-only
- [ ] Block L — Role-scope sweep (RLS)

---

# 🎤 DEMO TALKING POINTS (kung gusto mong i-highlight)

- **Role-based access control (RLS):** "Bawat role iba ang nakikita — naka-enforce sa database level mismo, hindi lang sa UI." (Block J/L)
- **AI-powered inventory:** "Local OCR (Tesseract) para sa DR slips + Gemini Vision para sa crate counting — auto-extract ng quantities." (Block C)
- **Live-computed billing:** "Ang billing ay auto-derived mula sa approved Ending Inventory + Special Orders + Packaging — hindi manual." (Block D → E)
- **Auto delivery enforcement:** "Stores na may overdue billing ay automatic na napupunta sa WARNING/HOLD." (Block A — yung WARNING/HOLD badges)
- **End-to-end franchise lifecycle:** "Mula application → approval → store creation → delivery → inventory → billing → payment, isang sistema lang." (Block B → C → D → E → F)
- **Optimistic UI + persistence:** "Lahat ng mutation ay instant sa screen at naka-save sa Supabase Postgres + Storage."

---

*Generated mula sa code analysis ng ZAPP Donuts ERP. Lahat ng account, mock data, at field name ay verified laban sa aktwal na source code.*
