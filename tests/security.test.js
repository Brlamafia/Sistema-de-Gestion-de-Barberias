import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, passwordIsValid, verifyPassword } from '../src/security.js';
import { clock, minutes } from '../src/db.js';

test('la contraseña se almacena como hash con sal', () => {
  const stored = hashPassword('Segura123');
  assert.notEqual(stored, 'Segura123');
  assert.match(stored, /^[a-f0-9]+:[a-f0-9]+$/);
});

test('la verificación acepta la contraseña correcta', () => {
  const stored = hashPassword('Segura123');
  assert.equal(verifyPassword('Segura123', stored), true);
});

test('la verificación rechaza una contraseña incorrecta', () => {
  const stored = hashPassword('Segura123');
  assert.equal(verifyPassword('Otra123', stored), false);
});

test('la política exige longitud, mayúscula, minúscula y número', () => {
  assert.equal(passwordIsValid('Valida123'), true);
  assert.equal(passwordIsValid('corta1A'), false);
  assert.equal(passwordIsValid('sinmayuscula1'), false);
});

test('las funciones de tiempo convierten sin pérdida', () => {
  assert.equal(minutes('09:30'), 570);
  assert.equal(clock(570), '09:30');
});
