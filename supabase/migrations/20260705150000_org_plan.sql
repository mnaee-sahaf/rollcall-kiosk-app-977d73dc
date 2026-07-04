-- Phase 4: billing plans (payments deferred). Tracks the org's tier; limits are
-- enforced in server functions. Real payment/subscription fields come later.
alter table public.organizations
  add column if not exists plan text not null default 'free';
alter table public.organizations
  add constraint organizations_plan_check check (plan in ('free', 'pro'));
