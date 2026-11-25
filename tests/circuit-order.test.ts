import assert from 'node:assert/strict';
import test from 'node:test';
import { CIRCUIT_IDS, GAME_CATALOG } from '../src/catalog.ts';
import { buildCircuitOrder, FIXED_CIRCUIT_ORDER } from '../src/games/circuitOrder.ts';
import { createSeededRng } from '../src/games/neuro/neuroEngines.ts';

const dims = (order: readonly string[]) =>
  order.map((id) => GAME_CATALOG[id as keyof typeof GAME_CATALOG].dimension);

test('buildCircuitOrder: mismos juegos y mismo patrón 3D/2D que el circuito fijo', () => {
  assert.equal(FIXED_CIRCUIT_ORDER.length, CIRCUIT_IDS.length);
  for (let seed = 1; seed <= 20; seed++) {
    const order = buildCircuitOrder(createSeededRng(seed));
    assert.deepEqual([...order].sort(), [...CIRCUIT_IDS].sort(), `seed ${seed}: mismos ids`);
    assert.deepEqual(dims(order), dims(FIXED_CIRCUIT_ORDER), `seed ${seed}: patrón 3D/2D`);
  }
});

test('buildCircuitOrder: semillas distintas no empiezan todas con aim3d ni repiten el orden fijo', () => {
  const orders = Array.from({ length: 20 }, (_, i) => buildCircuitOrder(createSeededRng(i + 1)));
  const firsts = new Set(orders.map((o) => o[0]));
  assert.ok(firsts.size > 1, 'el primer juego debe variar entre corridas');
  assert.ok(orders.some((o) => o.join() !== FIXED_CIRCUIT_ORDER.join()), 'debe barajar de verdad');
  assert.deepEqual(
    buildCircuitOrder(createSeededRng(7)),
    buildCircuitOrder(createSeededRng(7)),
    'misma semilla, mismo orden'
  );
});
