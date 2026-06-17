## [1.0] - 2021-08-01

> **Developer comment:** This patch aims at fixing major known bugs, aswell as adjusting potency of ships and builds that should dominate in specific domains.

### General

- Fixed a visual issue affecting Viking animations.
- Fixed minor hotkey conflicts on Colossus and Gaurdian.
- Restored missing graphics in profile/achievements menus - where it'd display purple backgrounds instead.
- Introduced advanced ping panel. (Available action set will be tailored better in future patches).
- Changed default game variant to "Balanced", which is essentially what was previously known as FFA. The difference is only on the lobby side, where list of players is now more compact - everyone is grouped under Team 1. (This also fixes annoying issue, where chat would default to `all` instead of `allies` in FFA setup).
- Restored some advanced lobby attributes to the "Custom" game variant, such as ability to choose map (loading custom map from bank file might now work again, but hasn't been tested).
- It's now possible to access upgrade & installation command cards while not at base.

### Battlecruiser

- Fixed lockdown to no longer cause its targets to stop abruptly, if connected with a ship that attempted to cast an ability.
- Nuke will now consistently lockdown ships in the area, regardless of whether it has connected with initial target.
- Yamato: reduction of cast time granted by upgrade reduced from 0.667s to 0.5s per each level.
- Fixed visual effect of defensive shield, that would *sometimes* persist throughout entire game.

> **Developer comment:** Battlecruiser is an early game ship, it got non-scaling abilities that by their mechanics are already working great whether it be 10 minutes or 100 minutes into the game.
> 
> In sb3.1, defensive shield was buffed to enhance shields and hull regeneration while active, and yamato was also considerably buffed. In lategame situation still, it is a bit overwhelming.
> 
> We're going to keep this unique defensive asset since, they are compensated by the fact that terran shields regardless of regen scale poorly as game goes on.

### Frigate

- Mines:
  - Increased placement separation by *roughly* 50%.
  - Increased explosion radius from 1.75 to 2.20
  - Increased bonus damage vs. Massive from 400 to 500
  - Increased auto cast range from 1.5 to 1.85
  - Increased sight range from 3.0 to 3.5
  - Upgrade: Increased bonus damage vs. Massive from 30 to 35 per level.

> **Developer comment:** Frigate's mines are too easily counterable. No matter how much you spend on this upgrade path, it takes one insightful player or one lucky detection to figure mines out, and then mines become virtually useless.
> 
> This change roughly keeps the same amount of damage dealt for a ship that would take a mined path, except one detection may not detect the entire minefield. A new detection feature should make them more viable aswell.

### Dreadnought

- Cover will no longer interact with Torpedo in mysterious ways - where it wouldn't connect with the target every other time.
- Increased upgrade cost of Protective Field from 150 to 175.

> **Developer comment:** Dreadnought is the early game tank, and it has a slightly too easy time transitionning towards mid/lategame where it still has a good impact on the game. This change should help softening it a little.

### Raven

- Fixed blackout to no longer cause its targets to stop abruptly, if connected with a ship that attempted to cast an ability.
- EMP:
  - Increased cooldown from 10s to 15s.
  - Enhanced systems upgrade will now reduce the cooldown by 5s.

> **Developer comment:** Raven , despite it being the most early game of the two supports, EMP is a little too forgiving and too rewarding when it comes to big team fights. This change should give a little larger window for enemies to play around.

### Carrier

- Hull armor reduced from 2 to 1.
- Shield armor reduced from 3 to 2.
- Particle disruptors attack speed increased by 10% (period changed from 0.22 to 0.2).
- Scouts:
  - Shield armor increased from 0 to 1.
  - Shield armor upgrade scaling reduced from 0.7 to 0.6.
- Tempests:
  - Weapon range increased from 13 to 14.
  - Weapon damage reduced from 40 (+40 massive) to 30 (+30 massive).

> **Developer comment:** Carrier, like most ships targetted by base armor reductions, could tank a little too thoughtlessly for its interceptors. It should now be more cautious as to when to protect its interceptors and when to keep its integrity.
> 
> The scout change is aimed at making them a viable opening, coming along with a small nerf when it comes to situation where enemies have little answers to them.
Tempests are a little underwhelming compared to other carrier's assets. Giving them +1 range should give them a longer lifespan to dish out some more damage.

### Colossus

- Shield armor reduced from from 5 to 4.
- Shield Recharge: reduced restoration ratio of shields from 18% to 16%.
- Guardian Shield: reduced damage reduction from 40% to 33%.

### Voidray

- Lockdown and Vortex will now properly shutdown personal cloaking field.
- Shield armor reduced from from 4 to 3.
- Shield regeneration ratio reduced from 7 to 6 per second.
- Energy nova:
  - Damage reduced from 30 (+210 massive) to 30 (+180 massive).
  - Phase Disruptors upgrade: Increased damage of Energy Nova from 4 (+7 massive) to 4 (+10 massive) per level.
- Purify:
  - Removed bonus to shield armor provided to the VR.
  - Reduction of target's weapon range reduced from 3 to 2.
  - Fixed an issue where the buff granting a chance to evade enemy abilities would always last 15s, miss-matching the duration of Purify (10s or 12.5s after the upgrade).

> **Developer comment:** Voidray's basic stats were a little too high for a glass cannon, compared to other ships. On top of that, nova has always been a threat regardless of how much money players invested in this build.
> 
> This change aims at making it less threatening when it is not its primary damage source, and also helps it on the long run if it commits to this build, especially against all the possible energy denial threats.
> 
> Purify was giving an unnecessary amount of buffs to voidray, so we removed some of them.

### Arbiter

- Shield armor reduced from 4 to 3.
- Khaydarin Core:
  - Removed bonus damage provided to Feedback.
  - [Tooltip] Removed incorrect info mentioning energy cost reduction granted to activation of Cloaking Field - it has never been the case.
  - [Tooltip] Added missing info about bonus damage provided to Electromagnetic Storm.

> **Developer comment:** Arbiter's weakness is earlygame, or at least should be. Yet it counters early game compositions on its own fairly easily and its abilities are also too polyvalent. We're starting by nerfing feedback damage so that when one uses feedback, it is actually more for the energy denial rather than the damage.

### Leviathan

- Hull armor reduced from 6 to 5.
- Frenzy: Reduction of incoming damage reduced from 33% to 25%.
- Aniomosity:
  - Maximum bonus to armor increased from 40% to 60%.
  - Maximum bonus to attack speed reduced from 40% to 20%.
  - Removed reduction of incoming damage. Tooltip incorrectly stated that reduction can go up to 10%, while effect provided mere 2.5% as soon as levi went below 80% HP, and it didn't scale at all.

> **Developer comment:** Leviathan is probably the strongest ship in v3.1 and Reloaded. We are not going to touch too much its early game and base stats since it could easily make it underwhelming. Still, once it has everything it needs, it is a hard task to shut it down. 
> 
> These changes will hopefully make fights less volatile and counterplays possible not only after frenzy, but during it.

### Guardian

- Parasite: cast range increased from 9 to 10.
- Decay:
  - [Tooltip] Updated description of the Decay upgrade, and its buff to reflect all effects provided by this ability.
  - [Tooltip] Updated description of the Carapace Armor, mentioning that it also increases bonus armor gained from Decay.
  - Damage reduction from incoming attacks reduced 4% to 3% per each stack.
  - Carapace Armor: bonus armor provided to each stack of Decay reduced from 0.08 to 0.07 per level.
- Broodlings:
  - [UI] Broodlings weapon will now be displayed in the equipment panel of Guardian, to ease access to informations.
  - [Tooltip] Updated description of Evolve Broodlings, to display correct number in regards to upgrade of Broodlings claws - it was stated to be 3, but it was actually 1.8.
  - Bonus damage to claws increased from 1.8 to 2.2 per each level of Broodlings upgrade.


> **Developer comment:** Guardian's bruiser path is actually a bit overwhelming compared to the minions path. We understand some of the changes made during 3.1 aimed at both making it viable and giving possible plays around infestation (purify also helps in that regard), but it has definitely stepped in the "top tier" side of the game.
> 
> So we're nerfing its tankiness so that it actually takes more damage from ships that are supposed to counter it, while leaving its strength against things it is supposed to counter anyways.
> 
> Broodlings damage were scaling at a rate of 1.8 damage per upgrade. Back in the days it would be 3 damage per upgrade. We're raising it to 2.2 (to be raised further), since guardian also spawns corruptors along with broodlords. 
> 
> Since this might not be enough, and new ship might be a new counter to these, broodlords will probably get buffed further.
