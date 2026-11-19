'use strict';
// Note di rilascio (note-di-rilascio.html): collegate dalla pagina principale, una sezione per
// data con almeno una voce, dalla più recente. A ogni aggiornamento pubblicato si aggiunge una
// sezione in cima (Docs/README.md, «Note di rilascio»).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
  'settembre', 'ottobre', 'novembre', 'dicembre'];

test('note di rilascio: collegate dalla pagina principale', () => {
  assert.match(read('index.html'), /href="note-di-rilascio\.html"/);
  assert.match(read('note-di-rilascio.html'), /href="index\.html"/);
});

test('note di rilascio: date valide, dalla più recente, ognuna con almeno una voce', () => {
  const html = read('note-di-rilascio.html');
  const sections = [...html.matchAll(/<section class="card release"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => m[1]);
  assert.ok(sections.length > 0);
  const dates = sections.map((s) => {
    const m = /<time datetime="(\d{4})-(\d{2})-(\d{2})">(\d{1,2}) (\w+) (\d{4})<\/time>/.exec(s);
    assert.ok(m, 'data mancante');
    assert.equal(Number(m[3]), Number(m[4]));
    assert.equal(Number(m[2]), MONTHS.indexOf(m[5]) + 1);
    assert.equal(m[1], m[6]);
    assert.match(s, /<li>/);
    return `${m[1]}-${m[2]}-${m[3]}`;
  });
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.equal(new Set(dates).size, dates.length, 'una sezione per data');
});
