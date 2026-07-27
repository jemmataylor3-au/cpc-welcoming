-- ============================================================================
-- CPC Welcoming Team App — Brand Alignment + Second Minister
-- ============================================================================
-- 1. Repoints existing welcomer colour swatches at the official CPC palette
--    (Style Guide Aug 2023 v1.1) instead of the earlier placeholder colours.
-- 2. Adds a second minister email address alongside the existing
--    minister/YA worker contacts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Welcomer swatches -> CPC palette
-- Old placeholder colours map onto the nearest official brand colour.
-- ----------------------------------------------------------------------------
update public.welcomers set color_hex = '#98454B' where color_hex = '#C8755B'; -- terracotta -> wine
update public.welcomers set color_hex = '#67BAB4' where color_hex = '#A7B5A0'; -- sage       -> teal
update public.welcomers set color_hex = '#103349' where color_hex = '#172B3A'; -- old navy   -> navy
update public.welcomers set color_hex = '#53796E' where color_hex = '#66727A'; -- slate      -> moss
update public.welcomers set color_hex = '#98454B' where color_hex = '#B85C5C'; -- red        -> wine
update public.welcomers set color_hex = '#5DBE80' where color_hex = '#5E8065'; -- old green  -> green
update public.welcomers set color_hex = '#AC8691' where color_hex = '#8B7355'; -- brown      -> mauve

-- Anything still outside the official palette falls back to navy.
update public.welcomers
set color_hex = '#103349'
where color_hex not in (
  '#0E1F27', '#103349', '#53796E', '#5DBE80', '#67BAB4',
  '#F1E0D8', '#ECBEB4', '#AC8691', '#CC9DBD', '#98454B'
);

-- ----------------------------------------------------------------------------
-- 2. Second minister contact
-- The 3-week and Bible study prompts go to the minister (or the YA worker
-- for Young Adults visitors). This adds a second minister who receives the
-- same prompts as the first — leave blank to disable.
-- ----------------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  (
    'minister_email_2',
    '',
    'Optional second minister. Receives the same 3-week and Bible study prompts as the primary minister. Leave blank to disable.'
  )
on conflict (key) do nothing;
