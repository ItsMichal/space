// md.mjs inline marks: :term colours and :fig chips (numbered figures, the cited one labelled).
import test from 'node:test';
import assert from 'node:assert/strict';
import { md } from './md.mjs';

const opts = { img: (src) => ({ src, width: 4, height: 3 }), youtube: () => '' };

test('terms take a known colour or fall back, and stay escaped', () => {
  const out = md('A :term[carrier]{c="orange"}, a :term[<b>x</b>]{c=pink}.', opts);
  assert.match(out, /<span class="term term-orange">carrier<\/span>/);
  assert.match(out, /<span class="term term-blue">&lt;b&gt;x&lt;\/b&gt;<\/span>/);
});

test('figures are numbered in order, a chip points at one and labels its caption', () => {
  const out = md('![a](/a.png "First")\n\n:::callout{type="note"}\n![b](/b.png)\n:::\n\nSee :fig[2], not :fig[0].', opts);
  assert.match(out, /id="fig-1"[^]*id="fig-2"/);
  assert.match(out, /<a class="figref" href="#fig-2" data-fig="2">/);
  assert.equal(out.match(/class="figno"/g).length, 1);
  assert.match(out, /<figcaption><span class="figno">fig 2<\/span><\/figcaption>/);
  assert.match(out, /:fig\[0\]/);
});
