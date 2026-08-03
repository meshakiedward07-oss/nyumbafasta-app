-- ════════════════════════════════════════════════════════════════════════
-- SOP & KPI Operating Layer — Phase 2: Seed 5 Department SOPs
-- All articles are audience='internal' — never visible to Amina or clients.
-- Run in the Supabase SQL editor AFTER sop_kpi_phase1_2026_08_02.sql.
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO knowledge_base (
  slug, title, body, category, language,
  audience, owner_role, sla_description, review_frequency, is_active
) VALUES

-- ── 1. Verification SOP ────────────────────────────────────────────────────────
(
  'sop-uthibitisho-dalali',
  'SOP: Uthibitisho wa Dalali (KYC)',
  E'LENGO\nKuhakikisha kila dalali anayetaka kufanya kazi kwenye NyumbaFasta amethibitishwa ipasavyo kabla ya kupost listings.\n\nHATUA ZA UTHIBITISHO\n\n1. POKEA OMBI\n   - Dalali anawasilisha KYC kupitia /dashboard/verify\n   - Mfumo unapeleka taarifa kwa admin: jina, picha ya kitambulisho, selfie\n   - Admin anapata arifa kwenye /admin/verification\n\n2. KAGUA KITAMBULISHO\n   - Thibitisha picha ya ID (NIDA, Pasipoti, au Leseni) inaonekana wazi\n   - Linganisha jina kwenye ID na jina kwenye akaunti (lazima vifanane)\n   - Thibitisha ID haijapitwa na wakati\n   - Kama ID ni ya NIDA: nambari iwe na tarakimu 20\n\n3. KAGUA SELFIE\n   - Linganisha uso kwenye selfie na picha ya ID\n   - Selfie iwe ya wazi, uso uonekane vizuri\n   - Hakikisha selfie si picha ya picha (anti-spoof check)\n\n4. KAGUA NAMBARI YA SIMU\n   - Nambari ya WhatsApp kwenye dalali_profiles iwe ni ya Tanzania (+255)\n   - Nambari iwe si nambari ya mteja mwingine aliyeshasajiliwa\n\n5. FANYA UAMUZI\n   Idhinisha (APPROVE):\n   - ID halisi + selfie inafanana + nambari ya TZ → Bonyeza Idhinisha\n   - Mfumo unabadilisha verification_status → \'verified\'\n   - Dalali anapata arifa ya WhatsApp kwamba ameidhinishwa\n   - Dalali anaweza sasa kupost listings\n\n   Kataa (REJECT):\n   - ID haionekani wazi / imeisha muda / haifanani na selfie\n   - Bonyeza Kataa → andika sababu fupi (itumwe kwa dalali)\n   - Dalali anaweza kuwasilisha upya baada ya kusahihisha\n\n   Omba Maelezo Zaidi (REQUEST_INFO):\n   - Kama picha hazionekani — omba upya badala ya kukataa moja kwa moja\n\n6. REKODI\n   - Kila uamuzi unabaki kwenye dalali_profiles.kyc_reviewed_at\n   - Kama unakataa kwa mara ya 3 mfululizo → fanya escalation kwa Msimamizi\n\nMASHARAMASHINE YA SLA\n- Ombi jipya lipitiwe ndani ya saa 24 za kazi\n- Kama dalali amewasilisha usiku/wikendi → lipitiwe mwanzo wa siku ya kazi inayofuata\n- Kama ombi ni zaidi ya saa 24 bila jibu → linaleta alert kwenye /admin/alerts',
  'verification', 'sw',
  'internal', 'admin',
  'Idhinisha au kataa ombi la KYC ndani ya saa 24 za kazi',
  'quarterly', true
),

-- ── 2. Customer Support SOP ────────────────────────────────────────────────────
(
  'sop-msaada-wateja',
  'SOP: Msaada wa Wateja na Malalamiko',
  E'LENGO\nKuhakikisha wateja wote wanapata jibu la haraka, zuri, na la kusaidia — hasa kuhusu malipo, listings, na mawasiliano na madalali.\n\nAINAS ZA MALALAMIKO NA JINSI YA KUSHUGHULIKIA\n\nA. MALIPO YAMESHINDWA AU HAYAKUTUMWA\n   1. Omba mteja: nambari ya simu iliyolipwa + wakati wa malipo\n   2. Angalia logs kwenye /admin/payments → tafuta kwa nambari ya simu\n   3. Kama malipo yalikamilika (status=success) lakini unlock haikufanyika:\n      - Fanya manual unlock kupitia /admin/users → [mteja] → Unlock Manually\n      - Tuma ujumbe kwa mteja: "Tumefanya upya. Angalia Nyumba Zilizofunguliwa."\n   4. Kama malipo yalishindwa kabisa (failed):\n      - Omba mteja ajaribu tena au atumie mtandao tofauti\n      - Kama tatizo linarudiwa → report kwa timu ya tech kwenye Slack #tech-alerts\n\nB. DALALI HAJIBU\n   1. Thibitisha dalali bado ana subscription inayofanya kazi\n   2. Angalia dalali_profiles.last_active — kama zaidi ya siku 7 bila shughuli:\n      - Piga simu dalali kupitia nambari yake ya whatsapp_number\n      - Kama hajibu ndani ya saa 48 → suspend listing zake (pending review)\n      - Tuma mteja listing mbadala kama ipo eneo moja\n   3. Rekodi hali kwenye /admin/users → [dalali] → Notes\n\nC. LISTING YENYE HABARI ZA UONGO\n   1. Pokea ripoti kutoka kwa mteja (screenshot au maelezo)\n   2. Angalia listing kwenye /admin/listings → suspend mara moja (status→suspended)\n   3. Wasiliana na dalali: "Listing yako imesimamishwa kwa sababu ya..."\n   4. Dalali anapewa saa 24 kusahihisha — kama hasisahihishi → futa listing\n   5. Kama dalali ana historia ya listings za uongo (mara 3+) → escalation kwa Msimamizi\n\nD. OMBI LA KURUDISHA PESA (REFUND)\n   Tunarejesha pesa PEKE YAKE kama:\n   - Unlock ilifanyika lakini nambari ya dalali haikutolewa (bug ya mfumo)\n   - Malipo yalifanyika mara mbili kwa bahati mbaya (duplicate charge)\n   HATUIRUDISHI kama:\n   - Mteja alipata nambari lakini dalali hajajibu (hii ni suala la dalali, si la mfumo)\n   - Mteja alibadilisha mawazo yake\n   Hatua za refund:\n   1. Thibitisha hali kupitia payment logs\n   2. Jaza fomu ya refund kwenye /admin/finance → Refund Request\n   3. Msimamizi wa fedha anaidhinisha ndani ya saa 24\n   4. Selcom inarejesha pesa ndani ya siku 3-5 za kazi\n\nMAZINGIRA YA MAWASILIANO\n- Jibu wateja ndani ya saa 2 za kazi\n- Tumia lugha ya Kiswahili, ya kirafiki lakini ya kitaalamu\n- Usiahidi mambo ambayo hayako kwenye uwezo wako — escalate badala yake\n- Kila conversation irekodiwe kwenye /admin/support-log',
  'customer_support', 'sw',
  'internal', 'staff',
  'Jibu malalamiko yote ya wateja ndani ya saa 2 za kazi',
  'monthly', true
),

-- ── 3. Sales SOP ───────────────────────────────────────────────────────────────
(
  'sop-mauzo-onboarding-dalali',
  'SOP: Mauzo na Onboarding ya Madalali Wapya',
  E'LENGO\nKuhakikisha kila dalali mpya anayejisajili anapata msaada wa haraka, anaweza kulipa subscription, na anaanza kupost listings ndani ya saa 48 za kwanza.\n\nFUNEL YA DALALI MPYA\n\nHATUA 1: DALALI ANAJISAJILI (Moja kwa moja)\n   - Dalali anajisajili kupitia /register → role=dalali\n   - Mfumo unaunda akaunti na kuingiza kwenye dalali_profiles\n   - Arifa inatumwa kwa admin kwenye /admin/users (badge: "Mpya")\n\nHATUA 2: UFUATILIAJI WA KWANZA (Ndani ya saa 2)\n   Sales rep anapiga simu au kutuma WhatsApp:\n   "Habari [Jina], karibu NyumbaFasta! Mimi ni [Jina lako] kutoka timu yetu.\n   Nilikuona umejisajili. Ninahitaji dakika 5 tu kukusaidia kuanza. Una muda?"\n\n   Malengo ya simu hii:\n   - Thibitisha nia yake (ana nyumba/vyumba za kupangisha?)\n   - Eleza bei: Basic Tsh 10,000/mwezi au Premium Tsh 25,000/mwezi\n   - Eleza faida za Premium (boost, verified badge, analytics)\n   - Peleka kwenye /subscription ili alipe\n\nHATUA 3: FUATILIA DALALI AMBAYE HAJALIPI (Saa 24)\n   Kama dalali hajalipi baada ya saa 24:\n   - Tuma WhatsApp: "Habari [Jina], je bado una nia? Subscription ya Basic ni Tsh 10,000 tu.\n     Unaweza kuanza kupost leo. Hapa kiungo: nyumbafasta.co/subscription"\n   - Kama hajibu ndani ya siku 3 → rekodi kwenye CRM kama "Cold Lead"\n\nHATUA 4: BAADA YA KULIPA — ONYESHA JINSI YA KUPOST\n   - Tuma video tutorial au guide ya maandishi:\n     "Hongera! Sasa unaweza kupost. Hapa jinsi ya kuanza: [link ya guide]"\n   - Kama dalali ana zaidi ya listing 3 wiki ya kwanza → ni ishara nzuri, wamuite Premium\n\nHATUA 5: UKAGUZI WA WIKI YA 1\n   Sales rep anafuatilia baada ya siku 7:\n   - Je, amepata inquiries/leads?\n   - Je, anahitaji msaada wa kuhariri listings?\n   - Kama hajapata leads: angalia ubora wa listings zake → msaidie kuboresha picha/maelezo\n\nUPSELL: BASIC → PREMIUM\n   Dalali wa Basic anafaa kupanda Premium kama:\n   - Amefika kikomo cha listings 5\n   - Ana zaidi ya inquiries 10 kwa wiki (ikionyesha mahitaji makubwa)\n   - Amekuwa Basic kwa miezi 2+\n   Ujumbe wa upsell: "Unaona dalali wa Premium wanafanya x3 zaidi ya leads."\n\nVIPIMO VYA MAFANIKIO (KPIs)\n- Dalali mpya → kwanza listing: lazima iwe chini ya saa 48\n- Kiwango cha ubadilishaji (signup → kulipa): lengo 40%+\n- Dalali wanaobaki baada ya miezi 3: lengo 70%+',
  'sales', 'sw',
  'internal', 'sales',
  'Wasiliana na dalali mpya ndani ya saa 2 za usajili; listing ya kwanza ndani ya saa 48',
  'monthly', true
),

-- ── 4. Finance SOP ─────────────────────────────────────────────────────────────
(
  'sop-fedha-malipo',
  'SOP: Usimamizi wa Fedha na Malipo',
  E'LENGO\nKuhakikisha malipo yote ya wateja na madalali yanafanywa vizuri, refunds zinafanywa kwa wakati, na ripoti za fedha zinaandaliwa kila mwezi.\n\nMALIPO YA KILA SIKU\n\n1. FUATILIA MALIPO YA SELCOM\n   - Angalia /admin/payments kila asubuhi (saa 9:00)\n   - Malipo yenye status=pending zaidi ya dakika 30 → trigger manual check\n   - Wasiliana na Selcom kama tatizo la API linajitokeza (contact: selcom-support@selcom.net)\n\n2. REKODI LA MAPATO\n   Aina za mapato:\n   a) Contact unlocks: Tsh 2,000 kwa kila unlock\n   b) Subscriptions: Tsh 10,000 (Basic) au Tsh 25,000 (Premium) kwa mwezi\n   c) Extra listings: Tsh 5,000 kwa listing ya ziada\n   d) Matangazo (advertisers): kulingana na makubaliano\n\n   Rekodi mapato kwenye /admin/finance → Mapato kila wiki Ijumaa\n\n3. SUBSCRIPTIONS ZINAZOKWISHA\n   - Mfumo unatuma arifa kwa dalali siku 7 kabla ya subscription kumalizika\n   - Kama dalali hajalipa ndani ya siku 3 za grace period:\n     → listings zinasimamishwa kiotomatiki (is_sub_suspended=true)\n     → tuma WhatsApp ya mwisho: "Subscription yako imekwisha. Lipa leo ili listings ziendelee."\n   - Kama hajalipa ndani ya siku 30 baada ya kumalizika:\n     → futa listings (admin inapendekeza, Msimamizi anaidhinisha)\n\nREFUNDS\n   Hali zinazostahili refund (ona pia SOP ya Customer Support):\n   - Bug ya mfumo: unlock ilifanyika lakini nambari haikutolewa\n   - Duplicate charge: Selcom ilichaji mara mbili\n\n   Hatua:\n   1. Support team inajaza ombi kwenye /admin/finance → Refund Requests\n   2. Finance manager anakagua ndani ya saa 24\n   3. Kama idhinishwa: piga simu Selcom API au fanya manual reversal\n   4. Rekodi kwenye finance log: sababu, kiasi, nani aliyeidhinisha\n   5. Tuma SMS/WhatsApp kwa mteja: "Tumerejesha Tsh X kwa namba yako. Itafika ndani ya siku 3-5."\n\nRIPOTI ZA KILA MWEZI\n   Siku ya 3 ya kila mwezi mpya, tengeneza:\n   a) Ripoti ya Mapato: jumla ya unlocks + subscriptions + ads\n   b) Ripoti ya Matumizi: hosting (Vercel), SMS (Beem), storage (Cloudinary), misc\n   c) P&L ya Mwezi: mapato - matumizi = faida/hasara\n   d) Top Dalali: madalali 10 wanaoleta mapato zaidi\n   e) Mikoa Yenye Shughuli Zaidi: kwa unlocks\n\n   Peleka ripoti kwa Msimamizi kwa PDF au Excel.\n\nTIAZO ZA FEDHA (RED FLAGS)\n- Malipo yanayoshindwa zaidi ya 20% kwa siku moja → wasiliana na Selcom mara moja\n- Refund requests zaidi ya 5 kwa wiki moja → investigate kama kuna bug\n- Mapato ya wiki yanashuka zaidi ya 30% → ripoti kwa Msimamizi leo hilo',
  'finance', 'sw',
  'internal', 'finance',
  'Kagua malipo yote kila asubuhi; refunds zikamilike ndani ya saa 48',
  'monthly', true
),

-- ── 5. Marketing SOP ───────────────────────────────────────────────────────────
(
  'sop-masoko-matangazo',
  'SOP: Masoko, Matangazo, na Udhibiti wa Watumiaji',
  E'LENGO\nKuhakikisha NyumbaFasta inakua kwa njia endelevu kupitia masoko sahihi, matangazo yanayofaa, na maudhui yanayovutia wateja na madalali wapya.\n\nKALENDA YA MASOKO YA KILA WIKI\n\nJumatatu:\n- Angalia analytics za wiki iliyopita (/admin/executive → Marketing metrics)\n- Unda content ya wiki: picha 3-5 za listings bora za kuchapisha\n- Panga machapisho kwenye Instagram na Facebook\n\nJumatano:\n- Chapisha "Listing ya Wiki" — chagua listing bora (picha nzuri, bei ya hewa, eneo maarufu)\n- Jibu maoni kwenye IG/FB ndani ya saa 2\n- Angalia metrics za chapisho la Jumatatu\n\nIjumaa:\n- Chapisha maudhui ya uelimishaji: "Jinsi ya Kupata Nyumba Bora" au "Dalali Mzuri Ni Nani?"\n- Tuma newsletter kwa madalali (kama inafanyika)\n- Tengeneza ripoti fupi ya wiki kwa Msimamizi\n\nMATANGAZO YA WAFANYABIASHARA (ADVERTISERS)\n\nHatua za kupitisha tangazo jipya:\n1. Advertiser anawasilisha matangazo kupitia /advertising/new\n2. Angalia tangazo ndani ya saa 24:\n   - Je, picha zinafaa (si za uchi, siasa, udanganyifu)?\n   - Je, maelezo ni ya kweli na yanafaa Tanzania?\n   - Je, kiungo kinaelekeza tovuti halisi?\n3. Kama inafaa → Idhinisha: status → active, tangazo linaonekana kwenye app\n4. Kama haifai → Kataa + eleza sababu: advertiser anapata email\n5. KABISA KATAZO: picha za udanganyifu, matangazo ya sarafu za kidijitali, ngono, dawa\n\nKUPANUA SOKO (GROWTH)\n\nMkakati wa kuvutia madalali wapya:\n- Partner na vikundi vya WhatApp vya madalali wa mji (Dar, Arusha, Mwanza)\n- Shiriki kwenye maonesho ya nyumba (property expos)\n- Referral program: dalali anayemrefer mwenzake anapata mwezi 1 bure\n\nMkakati wa kuvutia wateja:\n- Google Ads kwa maneno: "chumba Dar es Salaam", "nyumba ya kupanga Arusha"\n- Instagram Reels za video za nyumba (zana nzuri: CapCut)\n- Tuma listings kwa vikundi vya Facebook vya mitaa\n\nVIPIMO VYA MASOKO (KPIs)\n- Watumiaji wapya kwa wiki: lengo 200+\n- Cost per acquisition (CPA): lengo chini ya Tsh 500 kwa mteja mpya\n- Organic reach kwenye IG: lengo 5,000+ impressions kwa chapisho\n- Dalali wapya kwa mwezi: lengo 50+\n- Kiwango cha kubadilisha (visit → signup): lengo 3%+\n\nCRISIS COMMUNICATION\nKama tatizo kubwa la mfumo linatokea (downtime, bug ya malipo):\n1. Usipost maudhui mapya hadi tatizo limetatuliwa\n2. Tuma ujumbe wa haraka kwa wateja wanaouliza: "Tunafanya ukarabati wa haraka. Tutarudi hivi karibuni."\n3. Baada ya tatizo kutatuliwa → post ya shukrani na ufafanuzi mfupi',
  'marketing', 'sw',
  'internal', 'marketing',
  'Kagua matangazo mapya ndani ya saa 24; chapisha maudhui angalau mara 2 kwa wiki',
  'monthly', true
)

ON CONFLICT (slug) DO UPDATE SET
  title            = EXCLUDED.title,
  body             = EXCLUDED.body,
  category         = EXCLUDED.category,
  audience         = EXCLUDED.audience,
  owner_role       = EXCLUDED.owner_role,
  sla_description  = EXCLUDED.sla_description,
  review_frequency = EXCLUDED.review_frequency,
  updated_at       = NOW();
