import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-padel',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('reglas de Firestore', () => {
  it('un entrenador lee y escribe lo suyo, a cualquier profundidad', async () => {
    const db = env.authenticatedContext('ana').firestore();
    await assertSucceeds(setDoc(doc(db, 'coaches/ana/players/p1'), { name: 'Juan' }));
    await assertSucceeds(setDoc(doc(db, 'coaches/ana/matches/m1/points/x'), { order: 1 }));
    await assertSucceeds(getDoc(doc(db, 'coaches/ana/matches/m1/emotions/e1')));
  });

  it('no accede a lo de otro entrenador', async () => {
    const db = env.authenticatedContext('luis').firestore();
    await assertFails(getDoc(doc(db, 'coaches/ana/players/p1')));
    await assertFails(setDoc(doc(db, 'coaches/ana/matches/m1/points/y'), { order: 2 }));
  });

  it('sin sesión no accede a nada', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'coaches/ana/players/p1')));
  });

  it('fuera de coaches todo está denegado', async () => {
    const db = env.authenticatedContext('ana').firestore();
    await assertFails(getDoc(doc(db, 'otra/cosa')));
  });
});
