import { Count, Meter, Stage, Window, type Act } from '@/components/stageshow/kit'
import './office-wizards.css'

// Office Wizards: attacks are printed as barcodes and scanned to cast them.
// Beats: a half-sheet slip comes out of the printer with an attack on it; the
// scanner's line passes over its barcode; the spell lands and the other
// wizard's health drops. Plays once.
//
// Real strings: the players, health and stamina (from the game's UI sketch).

type S = { printed: boolean; scan: boolean; hit: boolean; hp: number; stamina: number }
const initial: S = { printed: false, scan: false, hit: false, hp: 100, stamina: 80 }
const poster: S = { printed: true, scan: false, hit: true, hp: 75, stamina: 55 }

async function script(a: Act<S>) {
  await a.wait(600)
  a.mark('print')
  a.put({ printed: true })
  await a.wait(1100)
  a.mark('scan')
  a.put({ scan: true })
  await a.wait(700)
  a.put({ scan: false, hit: true, hp: 75, stamina: 55 })
  await a.wait(2600)
}

function Player({ name, hp, stamina, side }: { name: string; hp: number; stamina: number; side: 'l' | 'r' }) {
  return (
    <div className="ow-player" data-side={side}>
      <span className="ow-name">{name}</span>
      <div className="ow-stat">
        <span>Health</span>
        <Meter value={hp / 100} tone={hp < 100 ? 'danger' : 'success'} />
        <Count value={hp} className="ow-n" />
      </div>
      <div className="ow-stat">
        <span>Stamina</span>
        <Meter value={stamina / 100} tone="warning" />
        <Count value={stamina} className="ow-n" />
      </div>
    </div>
  )
}

// Code 39 style widths for the slip's barcode, one entry per bar or gap
const BARS = [1, 1, 3, 1, 1, 3, 3, 1, 1, 1, 3, 1, 1, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1, 1, 1, 3, 1, 3, 1, 1, 3, 1, 1, 1]

export default function OfficeWizards() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" theme="dark" className="ow">
      {(s) => (
        <>
          <Window title="Office Wizards" className="dm-win ow-win">
            <div className="ow-page">
              <div className="ow-hud">
                <Player name="Player 1" hp={100} stamina={s.stamina} side="l" />
                <Player name="Player 2" hp={s.hp} stamina={80} side="r" />
              </div>
              <div className="ow-cast dm-in" data-on={s.hit || undefined}>
                Fireball! 25 damage
              </div>
            </div>
          </Window>
          <div className="ow-slip" data-on={s.printed || undefined}>
            <span className="ow-attack">FIREBALL</span>
            <span className="ow-meta">DMG 25 · STAMINA 25</span>
            <div className="ow-code" data-scan={s.scan || undefined}>
              {BARS.map((w, i) => (
                <span key={i} style={{ width: w * 2, background: i % 2 ? 'transparent' : '#111' }} />
              ))}
            </div>
          </div>
        </>
      )}
    </Stage>
  )
}
