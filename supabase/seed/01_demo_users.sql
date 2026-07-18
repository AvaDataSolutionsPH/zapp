-- ============================================================
-- ZAPP Donuts ERP — Phase 1 Auth Seed
-- ============================================================
--
-- HOW TO RUN:
--   1. Open Supabase dashboard → SQL Editor → New query
--   2. Paste this entire file and click "Run"
--   3. Verify under Authentication → Users (you should see 11 entries)
--
-- WHAT IT DOES:
--   Creates 11 demo users in auth.users with password "111111".
--   Inserts matching auth.identities rows so Supabase recognizes the
--   email provider. Idempotent — safe to re-run; existing emails are skipped.
--
-- PASSWORD:
--   All 11 accounts share the password: 111111
--   Change later via Auth → Users in the dashboard if needed.

-- Required for crypt() / gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  demo_password TEXT := '111111';
  user_emails TEXT[] := ARRAY[
    'alfonso@zappdonuts.com',          -- user-01 Owner
    'diana@zappdonuts.com',            -- user-02 Ops Manager
    'gabriel@zappdonuts.com',          -- user-03 Forecaster
    'helen@zappdonuts.com',            -- user-04 Plant Manager
    'ivan@zappdonuts.com',             -- user-05 Billing User
    'marco@zappdonuts.com',          -- user-06 Partner Distributor (Bicol)
    'legazpi.centro@zappdonuts.com',         -- user-07 Franchisee (Dist) - Maria Santos
    'legazpi.port@zappdonuts.com',           -- user-08 Franchisee (Direct) - Ana Lim
    'patricia@zappdonuts.com',         -- user-09 Area Supervisor
    'ricardo@zappdonuts.com',             -- user-10 Partner Distributor (Manila)
    'mariel@zappdonuts.com'        -- user-11 Sub-Partner Distributor
  ];
  user_email TEXT;
  new_user_id UUID;
BEGIN
  FOREACH user_email IN ARRAY user_emails LOOP
    -- Skip if email already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
      RAISE NOTICE 'Skipping existing user: %', user_email;
      CONTINUE;
    END IF;

    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      user_email,
      crypt(demo_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('email', user_email),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', user_email),
      'email',
      user_email,
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created user: %', user_email;
  END LOOP;
END $$;

-- Verify result
SELECT email, email_confirmed_at IS NOT NULL AS confirmed, created_at
FROM auth.users
ORDER BY created_at DESC;
