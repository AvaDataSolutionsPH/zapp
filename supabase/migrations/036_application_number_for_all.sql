-- ============================================================
-- 036 — Every application gets a searchable number (from 10001)
-- ============================================================
--
-- Boss: "gawan mo automatic na application number lahat. start with 10001. Para
-- madali mag search sa filter." Today the Application # column is "—" for every
-- row, because only the self-service /onboarding wizard ever set one.
--
-- ⚠️⚠️ THE DANGEROUS PART — READ BEFORE TOUCHING application_number.
--
-- The client currently identifies an onboarding application as:
--     const isOnboarding = !!application.applicationNumber;
-- and that flag drives APPROVAL behaviour in useStore.reviewApplication:
--   • isOnboarding → do NOT mint a Shop Code login (they already have one)
--   • isOnboarding → do NOT require a Shop Code before approving
--   • isOnboarding → build a different users profile
-- plus the Approve/Reject button labels and the Onboarding Details card.
--
-- So simply numbering every application would make the system treat EVERY
-- applicant as an onboarding partner: no franchisee login would ever be minted
-- again and the Shop Code requirement would vanish — silently destroying the
-- activation flow. The number must stop being the discriminator FIRST.
--
-- This migration therefore does two things, in order:
--   1. adds `application_source` as the explicit discriminator and backfills it
--      from the current heuristic, so nothing changes meaning;
--   2. only then hands out numbers to everyone.
--
-- The client keeps a fallback (`source ?? !!applicationNumber`) so a row written
-- by an older bundle still resolves correctly — Netlify is many commits behind
-- and may still be writing rows without the column.

-- ── 1. The real discriminator ────────────────────────────────

alter table public.applications
  add column if not exists application_source text;

alter table public.applications
  drop constraint if exists applications_source_check;

alter table public.applications
  add constraint applications_source_check
  check (application_source is null or application_source in ('apply', 'onboarding'));

-- Backfill using the exact rule the client used until now, so no row changes
-- behaviour on deploy.
update public.applications
   set application_source = case
         when application_number is not null and application_number <> '' then 'onboarding'
         else 'apply'
       end
 where application_source is null;

-- ── 2. The number ────────────────────────────────────────────
--
-- A sequence, not max()+1 in the client: two applicants submitting at the same
-- moment would otherwise be handed the same number, and /apply is public.

create sequence if not exists public.application_number_seq start with 10001;

-- Reserve a number. The onboarding wizard needs it BEFORE insert because it
-- prints it into the applicant's PDF copy, so this is callable rather than
-- purely a default. SECURITY DEFINER + granted to anon: /apply is public, and
-- handing out a counter value leaks nothing.
create or replace function public.next_application_number()
returns text
language sql
security definer
set search_path = public
as $$
  select nextval('public.application_number_seq')::text
$$;

grant execute on function public.next_application_number() to anon, authenticated;

-- Safety net: any row inserted without a number still gets one, so the column
-- can be relied on even if a client forgets to call the RPC.
create or replace function public.applications_assign_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.application_number is null or new.application_number = '' then
    new.application_number := nextval('public.application_number_seq')::text;
  end if;
  if new.application_source is null then
    new.application_source := 'apply';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_assign_number on public.applications;
create trigger applications_assign_number
  before insert on public.applications
  for each row execute function public.applications_assign_number();

-- Backfill the rows that have no number yet.
--
-- ⚠️ The numbers are UNIQUE but NOT guaranteed to follow submission order:
-- `nextval` is evaluated per updated row in whatever order the planner chooses,
-- so the ORDER BY below does not control which row gets which value. (Observed
-- on the live backfill: five rows came out 10001, 10002, 10005, 10003, 10004.)
-- That is fine for a searchable reference — uniqueness is the requirement, and
-- `submitted_at` remains the source of truth for chronology. Enforcing order
-- would need a per-row UPDATE loop; not worth it for a one-time backfill.
--
-- Onboarding rows KEEP their ZAPP-YYYYMMDD-#### number: it was printed into a
-- PDF the applicant already holds, and rewriting it would leave them quoting a
-- number the system no longer knows.
update public.applications a
   set application_number = (nextval('public.application_number_seq'))::text
 where a.application_number is null or a.application_number = '';

NOTIFY pgrst, 'reload schema';

-- ── REVERT ───────────────────────────────────────────────────
-- drop trigger if exists applications_assign_number on public.applications;
-- drop function if exists public.applications_assign_number();
-- drop function if exists public.next_application_number();
-- drop sequence if exists public.application_number_seq;
-- alter table public.applications drop column if exists application_source;
-- (application_number values stay — clearing them would restore the old
--  isOnboarding heuristic and re-break approval for the numbered rows.)
