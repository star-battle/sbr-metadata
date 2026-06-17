# [v4.7] - 2022-02-15

## General

- Autobalance & Rating:
  - Raised amount of games new player needs to complete in order to become rated, from 5 to 15. During this period player will earn/lose more points than rest of the team.
  - Numbers behind ship restrictions for newbies have been adjusted, so that all ships are unlocked once player is correctly rated.
  - Autobalance system has been almost entirely rewritten:
    - Greatly improved support for Squads:
      - Squaded players are now correctly recognized as favored.
      - If gap between rating of squaded players and other players within the game is too signficant to have a balanced match with even number of players on both sides, system may resort to 5v7 and other variants to bridge the gap.
    - New players should always be distributed equally among the teams, regardless of their internal rating.
  - Team's rating is now calculated once all players have picked their ships. (In the future it'll allow to factor player's experience on specific ship etc.).
- `Premade / IH` variant: Added lobby option `Team Side`:
  - Determines on which side teams preset in the lobby (Team 1 / Team 2), are going to be associated (i.e Team 1 = Terran/Red etc.). This option is ignored if autobalance is engaged.

## Bugfixes

- Fixed an issue where changing game variants once lobby has been hosted, could break slot layout (for instance hosting game as `Balanced` and then changing to `Premade` would move all slots to first team).
