import { checkValorantAccess } from '../lib/valorant'

// Read-only: status metadata only; never prints response bodies, identities or API keys.
async function main() {
  console.log(JSON.stringify(await checkValorantAccess({ riotId: process.env.VALORANT_TEST_RIOT_ID, puuid: process.env.VALORANT_TEST_PUUID, matchId: process.env.VALORANT_TEST_MATCH_ID, actId: process.env.VALORANT_TEST_ACT_ID }), null, 2))
}
void main()
