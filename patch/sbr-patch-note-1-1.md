## [1.1] - 2021-08-04

### General:

- Updated loading screen artwork to a final version (*probably*). Thanks to AmigoDeer!
- *Slightly* increased scale of Vikings and Phoenixes.
- Light units are no longer targetable by move ability.

> **Developer comment:** Viking bug is finally no more. Yet we retained one good thing about it. Increased sized allowed for guardian to stack acid more easily on creep, aswell as allows ships (mostly supports) being swarmed by Onboard-fighters to actually target fire some creep.

### Arbiter:

- Force Field: duration reduced from 5s to 4s.

> **Developer comment:** Arbiter's best earlygame ability is probably forcefields, but not because they have a generally strong impact, rather because they deny easily most of the earlygame sources, for little cost, and in all situations.
> 
> Early game ships/compositions are supposed to be threatening and pushy, and in this specific scenario, when arbiter's team is retreating, forcefields are the most efficient, since they can block 2 missile volleys from the same ship.
> 
> We're slightly reducing their duration so that they are less effective during retreats, but their use shouldn't be affected during pushes. We also know that it nerfs arbiter in a second way, forcing it to put more focus and APM into using this ability, so while we're being cautious with this ability, this might also increase skillcap and make great arbiters stand out from good arbiters.

### Guardian:

- Broodlings:
  - Bonus damage to claws increased from 2.2 to 2.5 per each level of Broodlings upgrade. (It was already buffed in previous patch, but we haven't nailed the value at the time).
- Corruptors:
  - Base damage reduced from 20 (+10 massive) to 15 (+5 massive).
  - Model's scale increased by ~30%

> **Developer comment:** As soon as a game uses rounded numbers (whether it be 1,2,5 or bigger rounds like 25 50 100), game cannot be perfectly balanced because rounding up or down a specific value will necessarily miss the "balance-perfect theoretical value". Except that for broodlings attacks, they come in such higher numbers that we need to use decimal values. We'll slowly adjust them so that they fit in without being overwhelming.
> 
> Corruptors do scale strongly and farm easily aswell, so we're reducing their base damage so that they can be less threatening early on. Also when it comes to diving broodlords and corruptors, broodlords are lasers highest priority targets, giving corruptors some precious time to deal serious damage to ships. The more minions are around, the bigger this effect is.
> 
> So we're giving some possibility of counterplay by increasing their size and allowing players to target fire them more easily.


### Bugfixes:

- Fixed Frigate starting with 8.0 range, instead of 7.5 range as it was previously.
- Fixed Arbiter being unable to turn off the cloaking field, while having Phantom of itself (or another Arbiter) in its selection.
- Fixed missing impact FX on Explosive Charge.
- Fixed missing impact shockwave on BC's Nuke, when not connected with the target.
- Fixed Corruptor being tinted in a green color, instead of using team colors.
- Fixed Broodlords having two actors - they'd stack on top of each other (as if there were two units, but it was one).
- Fixed learn ability of Guardian that would allow getting Parasite upgrade past the range of base.
- Fixed out of date tooltip description on "Learn Parasite", and missing passive button after the upgrade.
- Fixed tooltip on Decay - where it wouldn't display all details until ability has been learned.
- Fixed tooltip of Posthumous Mitosis - where it would display description of Decay instead.
