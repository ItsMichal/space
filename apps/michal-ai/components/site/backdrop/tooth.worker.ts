/**
 * Generates the paper tooth off the main thread (about 35 ms of arithmetic at full speed, 140 ms at 4x CPU throttle, which
 * used to block the first frames). Same function as the synchronous path in tooth.ts, so the bytes are identical.
 */
import { makeTooth } from './tooth'

self.onmessage = () => {
  const data = makeTooth()
  ;(self as unknown as Worker).postMessage(data, [data.buffer])
}
