/* Copyright (c) 2026, mjk0717. */

/******************************************************************************
 *
 * This software is dual-licensed to you under the Universal Permissive License
 * (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
 * 2.0 as shown at https://www.apache.org/licenses/LICENSE-2.0. You may choose
 * either license.
 *
 * NAME
 *   thin10gAuth.js
 *
 * DESCRIPTION
 *   Tests the isolated legacy Oracle 10G verifier implementation.
 *
 *****************************************************************************/
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const encryptDecrypt = require('../lib/thin/protocol/encryptDecrypt.js');
const legacy10GAuth = require('../lib/thin/protocol/legacy10GAuth.js');

function cryptAES(value, key, decrypt) {
  const cipher = decrypt ?
    crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16)) :
    crypto.createCipheriv('aes-128-cbc', key, Buffer.alloc(16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(value), cipher.final()]);
}

describe('330. thin10gAuth.js', function() {

  it('330.1 produces known Oracle 10G password verifier hashes', function() {
    const cases = [
      ['SCOTT', 'TIGER', 'F894844C34402B67'],
      ['SYSTEM', 'MANAGER', 'D4DF7931AB130E37'],
      ['SYS', 'CHANGE_ON_INSTALL', 'D4C5016086B2DC6A']
    ];

    for (const [username, password, expected] of cases) {
      const actual = legacy10GAuth.getPasswordHash(username, password);
      assert.strictEqual(actual.toString('hex').toUpperCase(), expected);
      actual.fill(0);
    }
  });

  it('330.2 treats username and password as case-insensitive', function() {
    const upper = legacy10GAuth.getPasswordHash('SCOTT', 'TIGER');
    const mixed = legacy10GAuth.getPasswordHash('Scott', 'Tiger');
    assert.deepStrictEqual(mixed, upper);
    upper.fill(0);
    mixed.fill(0);
  });

  it('330.3 derives the legacy client session key and combo key', function() {
    const passwordHash = legacy10GAuth.getPasswordHash('SCOTT', 'TIGER');
    const encryptionKey = Buffer.concat([passwordHash, Buffer.alloc(8)]);
    const serverKey = Buffer.concat([
      Buffer.from(Array.from({length: 32}, (_, i) => i)),
      Buffer.alloc(16, 16)
    ]);
    const encodedServerKey = cryptAES(serverKey, encryptionKey, false);
    const result = legacy10GAuth.deriveSessionKeys(
      {AUTH_SESSKEY: encodedServerKey.toString('hex')}, 'SCOTT', 'TIGER'
    );
    const clientKey = cryptAES(
      Buffer.from(result.sessionKey, 'hex'), encryptionKey, true
    );
    const mixedKey = Buffer.alloc(16);
    for (let i = 0; i < mixedKey.length; i++) {
      mixedKey[i] = serverKey[i + 16] ^ clientKey[i + 16];
    }
    const expectedComboKey = crypto.createHash('md5').update(mixedKey).digest();

    assert.strictEqual(result.sessionKey.length, 64);
    assert.deepStrictEqual(result.comboKey, expectedComboKey);

    passwordHash.fill(0);
    encryptionKey.fill(0);
    serverKey.fill(0);
    encodedServerKey.fill(0);
    clientKey.fill(0);
    mixedKey.fill(0);
    expectedComboKey.fill(0);
    result.comboKey.fill(0);
  });

  it('330.4 encrypts the password using the derived combo key', function() {
    const password = 'Tiger!';
    const passwordHash = legacy10GAuth.getPasswordHash('SCOTT', password);
    const encryptionKey = Buffer.concat([passwordHash, Buffer.alloc(8)]);
    const serverKey = Buffer.concat([
      Buffer.alloc(32, 0x5a),
      Buffer.alloc(16, 16)
    ]);
    const authObj = {};

    encryptDecrypt.updateVerifierData10G({
      AUTH_SESSKEY: cryptAES(serverKey, encryptionKey, false).toString('hex')
    }, 'SCOTT', password, undefined, authObj);

    const plaintext = encryptDecrypt.decrypt(
      authObj.comboKey, Buffer.from(authObj.encodedPassword, 'hex')
    );
    assert.strictEqual(
      plaintext.subarray(16, 16 + Buffer.byteLength(password)).toString(),
      password
    );

    passwordHash.fill(0);
    encryptionKey.fill(0);
    serverKey.fill(0);
    authObj.comboKey.fill(0);
    plaintext.fill(0);
  });

  it('330.5 rejects malformed server session keys', function() {
    assert.throws(
      () => legacy10GAuth.deriveSessionKeys(
        {AUTH_SESSKEY: 'not-hex'}, 'SCOTT', 'TIGER'
      ),
      /NJS-173:/
    );
  });
});
