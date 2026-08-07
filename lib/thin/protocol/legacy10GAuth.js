/* Copyright (c) 2026, mjk0717. */

//-----------------------------------------------------------------------------
//
// This software is dual-licensed to you under the Universal Permissive License
// (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
// 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
// either license.
//
// If you elect to accept the software under the Apache License, Version 2.0,
// the following applies:
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------

'use strict';

const { Buffer } = require('buffer');
const crypto = require('crypto');
const errors = require('../../errors.js');

const AES_BLOCK_SIZE = 16;
const DES_BLOCK_SIZE = 8;
const ORACLE_10G_DES_KEY = Buffer.from('0123456789ABCDEF', 'hex');

function crypt(algorithm, key, iv, value, decrypt) {
  const cipher = decrypt ?
    crypto.createDecipheriv(algorithm, key, iv) :
    crypto.createCipheriv(algorithm, key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(value), cipher.final()]);
}

/*
 * Node.js does not expose single DES in its default OpenSSL configuration.
 * Triple DES with K1 = K2 = K3 is mathematically equivalent to single DES.
 */
function encryptDES(value, key) {
  const tripleDESKey = Buffer.concat([key, key, key]);
  try {
    return crypt('des-ede3-cbc', tripleDESKey,
      Buffer.alloc(DES_BLOCK_SIZE), value, false);
  } finally {
    tripleDESKey.fill(0);
  }
}

function encryptAES(value, key) {
  return crypt('aes-128-cbc', key, Buffer.alloc(AES_BLOCK_SIZE), value, false);
}

function decryptAES(value, key) {
  return crypt('aes-128-cbc', key, Buffer.alloc(AES_BLOCK_SIZE), value, true);
}

function getServerSessionKey(sessionData) {
  const value = sessionData.AUTH_SESSKEY;
  if (typeof value !== 'string' || value.length !== 96 ||
      !/^[0-9a-f]+$/i.test(value)) {
    errors.throwErr(errors.ERR_INVALID_SERVER_RESPONSE);
  }
  return Buffer.from(value, 'hex');
}

/**
 * Implements the legacy Oracle 10G password verifier and key exchange.
 * This protocol is retained only for compatibility with servers that select
 * verifier type 0x939. It is not used by the 11G and 12C verifier paths.
 */
class Legacy10GAuth {

  getPasswordHash(username, password) {
    const utf16 = Buffer.from((username + password).toUpperCase(), 'utf16le');
    utf16.swap16();
    const paddedLength = Math.ceil(utf16.length / DES_BLOCK_SIZE) *
      DES_BLOCK_SIZE;
    const padded = Buffer.alloc(paddedLength);
    utf16.copy(padded);
    let firstPass;
    let secondPass;

    try {
      firstPass = encryptDES(padded, ORACLE_10G_DES_KEY);
      const firstPassKey = firstPass.subarray(firstPass.length - DES_BLOCK_SIZE);
      secondPass = encryptDES(padded, firstPassKey);
      return Buffer.from(
        secondPass.subarray(secondPass.length - DES_BLOCK_SIZE)
      );
    } finally {
      if (firstPass)
        firstPass.fill(0);
      if (secondPass)
        secondPass.fill(0);
      utf16.fill(0);
      padded.fill(0);
    }
  }

  deriveSessionKeys(sessionData, username, password) {
    const encodedServerKey = getServerSessionKey(sessionData);
    let passwordHash;
    let encryptionKey;
    let serverKey;
    let clientKey;
    let encodedClientKey;
    let mixedKey;

    try {
      passwordHash = this.getPasswordHash(username, password);
      encryptionKey = Buffer.alloc(AES_BLOCK_SIZE);
      passwordHash.copy(encryptionKey);
      serverKey = decryptAES(encodedServerKey, encryptionKey);
      clientKey = Buffer.alloc(AES_BLOCK_SIZE * 2);
      crypto.randomFillSync(clientKey);
      encodedClientKey = encryptAES(clientKey, encryptionKey);
      mixedKey = Buffer.alloc(AES_BLOCK_SIZE);
      for (let i = 0; i < AES_BLOCK_SIZE; i++) {
        mixedKey[i] = serverKey[i + AES_BLOCK_SIZE] ^
          clientKey[i + AES_BLOCK_SIZE];
      }
      return {
        comboKey: crypto.createHash('md5').update(mixedKey).digest(),
        sessionKey: encodedClientKey.toString('hex').toUpperCase()
      };
    } finally {
      encodedServerKey.fill(0);
      for (const value of [passwordHash, encryptionKey, serverKey, clientKey,
        encodedClientKey, mixedKey]) {
        if (value)
          value.fill(0);
      }
    }
  }
}

module.exports = new Legacy10GAuth();
