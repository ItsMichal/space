# Gallery drag (760 ms) and series disclosure (328 ms): harness artefacts, not product latency

Both numbers from the first audit came from how the harness timed the input, not from the components.

- Disclosure: the scenario marks "input" and then calls `click`, which hovers 220 ms before pressing (so React Router prefetch can fire, as for a real user). Timing started at the mark, so every marked scenario carried the dwell (the nav and lightbox rows in the route table did too). Timing now starts at the first real input event after the mark.
  Corrected, desktop cpu 4x: first visual response 328 to 42 ms, first DOM change (`.dc-box` height) 10 ms; the height spring is smooth (41 frames, 0 reversals, jerk ratio 0.017, 0 dropped frames).
- Gallery drag: 760 ms came from the synthetic drag pacing under 4x throttle (the first pointer move that crosses the 4 px axis threshold was late); repeat runs give 55 to 100 ms first response and a smooth track (0 dropped frames). The 7 to 8 "stall" frames are coalesced pointer events at 16 ms spacing; the spring then settles without a stall.
- Harness fixes: tracked-element metrics were empty since the probe went light (they now read the screencast pass), and `domResponseMs` (first tracked box change) is reported next to the screenshot-based response.
- Not changed in the product: Disclosure and Gallery already animate only height (JS spring) and transform/opacity.
