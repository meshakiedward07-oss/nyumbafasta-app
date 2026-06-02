-- ─────────────────────────────────────────────────────────────────────────────
-- Fallback: kama huwezi kubadilisha kuwa TEXT — ongeza values kwenye enum
-- Run hii BADALA YA fix_payment_method_enum.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Kwanza angalia jina halisi la enum type:
SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typtype = 'e'
ORDER BY typname, enumsortorder;

-- Kisha ongeza values zote zinazokosekana
-- (badilisha 'payment_method_type' na jina halisi kutoka query hapo juu)

ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'mpesa';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'mixyyas';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'airtel';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'halopesa';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'mastercard';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'visa';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'mock';
