import Image from 'next/image'
import { normalizeRiotId } from '../../../lib/player-identity'
import { bracketSizeError } from '../../../lib/bracket-sizes'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <main>
    <h1>Workers feasibility probe</h1>
    <p>This isolated fixture does not implement the esigglol application.</p>
    <p data-probe="identity">{normalizeRiotId(' Player # EUW ')}</p>
    <p data-probe="bracket">{bracketSizeError('elimination', 8) === null ? 'valid-bracket' : 'invalid-bracket'}</p>
    <Image src="/probe.svg" alt="Probe asset" width={24} height={24} />
  </main>
}
