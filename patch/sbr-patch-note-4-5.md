# [v4.5] - 2022-01-26

## General

- Ship restrictions will now also consider player's total amount of games in SB3.1, SBO, that have been recorded by sc2arcade.com within the last ~1.5 years. This number will factor in following way:
  - In case of fresh bank file, player will no longer be limited by *newbie restrictions*.
  - Additionally it'll factor towards *veteran restrictions* - if threshold will be meet it'll unlock first half of the ships - but not all of them.

## Ships & Balance

### Guardian

- Fixed weapon / target acquisition on Corruptors, to no longer be so passive when Capital Ships are firing at them from a position beyond their weapon range. They'll now aggro on CS in response to the damage. (Basically they once again respect classic attack priority chain).

## Omega-SBR

- Normalized base energy regen ratio to match with SBR - it's higher. The ratio from upgrades is also from SBR. However it's a bit lower - 0.4 per level, instead of 0.5, as it is in Omega.
- Incorporated Advanced Tac Fighters to BC.
- Fixed an issue where cloaked ships (most importantly VR) would be visible on the minimap to the opposing team.

## Bugfixes

- Fixed an issue where EMP AoE cursor wasn't aligned with its logical effect (visual radius was larger by 0.5).
