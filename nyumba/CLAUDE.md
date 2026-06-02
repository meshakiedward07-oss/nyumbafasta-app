# NyumbaFasta – Project Context

## Nini hii project?
Platform ya Tanzania inayowakutanisha madalali wa nyumba/vyumba na wateja wao.
Kama "Booking.com + WhatsApp + Dalali system" kwa market ya Tanzania.

## Business Model
- **Wateja (clients):** Wanalipa Tsh 2,000 kupata nambari ya WhatsApp ya dalali
- **Madalali:** Wanalipa subscription ya kila mwezi:
  - Basic = Tsh 10,000/mwezi (listings 5)
  - Premium = Tsh 25,000/mwezi (listings 20 + boost + verified badge + analytics)

## Tech Stack
- **Frontend + API:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (Email, Google, Phone OTP)
- **Malipo:** Selcom API (M-Pesa, Airtel Money, Tigo Pesa)
- **Picha:** Cloudinary
- **SMS:** Beem Africa
- **Hosting:** Vercel

## Database Tables (zote 8 zipo Supabase)
1. **users** – wateja, madalali, admins (role: client/dalali/admin)
2. **dalali_profiles** – whatsapp_number, bio, rating_avg, is_premium_verified
3. **subscriptions** – plan (basic/premium), status, expires_at
4. **listings** – type, status, price_monthly, region, district, amenities, images
5. **contact_unlocks** – malipo ya client kupata WhatsApp ya dalali (Tsh 2,000)
6. **reviews** – rating (1-5), comment, per unlock moja
7. **saved_listings** – listings client alizozihifadhi
8. **notifications** – arifa za mfumo

## Listing Status Flow
pending → active → taken/expired
pending → rejected (na admin)

## Folder Structure
```
app/
  (auth)/login/          – Login page (Email + Google + Phone OTP)
  (auth)/register/       – Register
  (client)/              – Home, listing detail, saved, account
  (dalali)/              – Dashboard, add listing, subscription
  (admin)/               – Approve listings, manage users, stats
  api/v1/                – API routes zote
    auth/                – request-otp, verify-otp, me
    listings/            – GET search, POST create, PATCH status
    payments/            – unlock/initiate, webhook, subscription
    dalali/              – dashboard, my-listings
    admin/               – pending, approve, reject, stats
lib/
  supabase/
    client.ts            – Browser client
    server.ts            – Server client + admin client
  utils/
    auth.ts              – JWT verify helper
    whatsappUrl.ts       – Build WhatsApp URL
    formatPrice.ts       – Format Tsh prices
components/
  listings/              – ListingCard, ListingGrid, ListingFilters
  payments/              – UnlockModal, PaymentPoller
  dalali/                – DashboardStats, DalaliCard
  shared/                – Navbar, BottomNav, Skeleton, EmptyState
```

## Design System (Rangi)
- **Primary green:** #1D9E75 (primary-500)
- **Light green:** #E1F5EE (primary-50)
- **Dark green:** #085041 (primary-800)
- **Amber:** #EF9F27 (bei, deposit)
- **Red:** #E24B4A (errors, reject)

Kwenye Tailwind:
- `bg-primary-500` = header, buttons za main
- `text-primary-600` = bei ya listing
- `bg-primary-50` = badge ya "Inapatikana"

## API Endpoints zilizokamilika
- POST /api/v1/auth/request-otp
- POST /api/v1/auth/verify-otp
- GET  /api/v1/auth/me
- GET  /api/v1/listings (search + filter)
- POST /api/v1/listings (create – dalali tu)
- PATCH /api/v1/listings/:id/status
- POST /api/v1/payments/unlock/initiate (STK Push)
- POST /api/v1/payments/webhook (Selcom callback)
- POST /api/v1/payments/subscription/initiate

## Screens zilizoundwa (mockups – zifuate hasa)
1. Home/Search – listings grid, filters, search bar
2. Listing detail – picha gallery, maelezo, dalali card, unlock paywall
3. M-Pesa payment – STK Push flow, timer, confirmation
4. Dalali dashboard – stats, listings, subscription status
5. Add listing – hatua 4: maelezo → location → amenities → preview
6. Listing confirmation + next steps
7. Basic vs Premium subscription
8. Client onboarding – splash, register, OTP, preferences, welcome
9. Admin panel – listings approval, users, mapato, settings

## Mikoa Tanzania (31 yote imewekwa)
Data: `lib/data/tanzania-locations.ts`

**Priority regions (tabs za haraka):** Dar es Salaam, Arusha, Mwanza, Dodoma, Zanzibar Mjini Magharibi, Kilimanjaro, Tanga, Mbeya

**Mikoa yote 31:**
Dar es Salaam · Arusha · Kilimanjaro · Tanga · Morogoro · Pwani · Dodoma · Mwanza · Mara · Kagera · Shinyanga · Tabora · Kigoma · Rukwa · Katavi · Mbeya · Songwe · Iringa · Njombe · Ruvuma · Lindi · Mtwara · Singida · Geita · Simiyu · Manyara · Zanzibar Mjini Magharibi · Zanzibar Kaskazini Unguja · Zanzibar Kusini Unguja · Zanzibar Kaskazini Pemba · Zanzibar Kusini Pemba

Kila mkoa una districts zake — `getDistricts(regionName)` inarudisha orodha.

## Kanuni za Coding
- Tumia TypeScript daima
- Tumia Tailwind CSS – usiandike CSS ya kawaida
- Tumia Supabase client kwa queries – usiandike SQL moja kwa moja kwenye components
- Server Components kwa data fetching, Client Components kwa interactivity
- Kila component iwe na file yake yenyewe
- Majina ya Kiswahili kwenye UI (simu, bei, mtaa, nk)
- Mobile-first design – app inatumika zaidi kwenye simu

## Mazingira ya Maendeleo
- Local: http://localhost:3000
- Supabase project: (weka URL yako hapa)
- Node version: 20+
- Package manager: npm

## Hatua Iliyofika — NyumbaFasta App

### Imekamilika ✅
- Database tables 8 + RLS policies
- Authentication (Email + Google)
- Home page na listings
- Dalali registration na dashboard
- Add listing form (hatua 4)
- Save listing feature
- Profile picture upload (Cloudinary)
- Video upload kwenye listings
- Dalali verification (NIDA)
- Listing status (active/taken/pending)
- Logo ya NyumbaFasta kwenye header
- WhatsApp customer care button
- Role-based navigation (admin/dalali/client)

### Inayohitajika ⏳
- Listings zinaonyesha 0 — fix RLS na unda test data
- M-Pesa real payment (Selcom API)
- Push notifications
- Deploy kwenye Vercel
- Share listing WhatsApp button
- Map view ya listings
