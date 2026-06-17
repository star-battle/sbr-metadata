# [v2.4] - 2021-09-05

## General:

- End game screen will now appear quicker - after 2s, relatively to the time where SB match concludes (once rating points are awarded), instead of 15s as it was previously.
  > This should effectively fix the problem where some of the games in SC2's match history were incorrectly flagged as undecided/lost for both sides, simply because neither of the players remained in the game long enough to report result of a match back to Battle.net.

## Bugfixes:

- Leviathan: Verified and updated all tooltips in terms of their correctness.
- Frigate: Fixed Torpedo cancel ~~exploit~~ trick:
  - Cancelled torpedo has the same energy cost as launched one, however it only needs 6s to cooldown.
  - It's now considered to be a feature.
- Restored missing alerts such as "Upgrade Complete" etc. ; most notably alerts related to nuke & torpedo. Additionally nuke alerts will now also be propagated to allies and pinged on the minimap.
- Restored `MiddleMouseButton` to `CameraPush` under default hotkey profile - dragging camera with `MMB` works under default settings again. (As a side effect `MMB` can't be used for *pinging* Minerals label for now, due to `CameraPush` having higher priority).\
  Reminder: [`MMB` can always be changed to another combination in Hotkey settings](./assets/2.4/hotkeys.png)
- TrustGate: Fixed an issue where game wouldn't pick one of the players to observe, in order to maintain equal number of players on both teams (to avoid 5v6 etc.).
- TrustGate: Fixed an issue where player who had bought HotS or LotV campaign exclusively - without buying WoL on the way, could fail to pass the gate, if they'd timed out during standard procedure.
