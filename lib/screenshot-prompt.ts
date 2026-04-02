export const DEFAULT_SCREENSHOT_PROMPT = `Analyze this League of Legends end-game screenshot and extract player data into JSON.

Return ONLY valid JSON matching this exact schema (no markdown, no backticks, no explanation):

{
  "duration": "MM:SS",
  "date": "MM/DD/YYYY",
  "winner": "team1" or "team2",
  "team1Players": [
    {
      "summonerName": "PlayerName",
      "championName": "ChampionKey",
      "level": 18,
      "kills": 5,
      "deaths": 2,
      "assists": 8,
      "cs": 200,
      "gold": 15000,
      "items": ["ItemName1", "ItemName2", ...],
      "keystone": "KeystoneName"
    }
  ],
  "team2Players": [same structure]
}

Rules:
- "winner": If the header says "DEFEAT", the screenshot is from team1's perspective → team2 won. If "VICTORY" → team1 won.
- "championName": Use the official English DDragon champion key (PascalCase). Examples: "Yone", "MonkeyKing" (for Wukong), "Ahri", "Fiddlesticks", "KSante", "Renata". If the champion is only shown as a portrait with no readable text name (e.g. Spanish client), use "" — do NOT guess from the portrait alone.
- "items": If item icons are clearly readable, list them by their official English name (include trinket/ward, skip empty slots, max 8). If the icons are too small or unclear to identify reliably, use an empty array [] — do NOT guess item names.
- "keystone": The primary keystone rune name in English (e.g. "Conqueror", "Electrocute", "FleetFootwork", "Grasp of the Undying"). If the keystone icon cannot be reliably identified, use "" — do NOT guess.
- "gold": Individual player gold, not team total.
- "cs": Minions killed count for that player. Note: some scoreboard layouts label a column as CS but actually display gold/min — use whatever integer value appears in that column. If the column shows a decimal (e.g. "7.4"), round to the nearest integer.
- "date": Extract from the header if visible, format MM/DD/YYYY.
- Players are listed top to bottom as they appear in the screenshot.
- There should be exactly 5 players per team.`
