-- Existing display names remain available to older clients and as a fallback
-- until the member fills in the two new fields.
alter table public.profiles
  add column name_zh text check (char_length(btrim(name_zh)) between 1 and 100),
  add column name_en text check (char_length(btrim(name_en)) between 1 and 100);

grant update(name_zh, name_en) on public.profiles to authenticated;
