/* Copyright (c) 2026, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * This software is dual-licensed to you under the Universal Permissive License
 * (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
 * 2.0 as shown at https://www.apache.org/licenses/LICENSE-2.0. You may choose
 * either license.
 *
 * If you elect to accept the software under the Apache License, Version 2.0,
 * the following applies:
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   thin11g.js
 *
 * DESCRIPTION
 *   Tests the Oracle Database 11g Release 2 Thin mode compatibility path.
 *
 *****************************************************************************/
'use strict';

const oracledb = require('oracledb');
const assert = require('assert');
const dbConfig = require('./dbconfig.js');

describe('329. thin11g.js', function() {
  let connection;
  let isRunnable = false;
  const tableName = 'nodb_thin11g';

  before(async function() {
    connection = await oracledb.getConnection(dbConfig);
    isRunnable = oracledb.thin &&
      connection.oracleServerVersion >= 1102000000 &&
      connection.oracleServerVersion < 1200000000;
    if (!isRunnable) {
      this.skip();
    }

    try {
      await connection.execute(`DROP TABLE ${tableName} PURGE`);
    } catch (err) {
      if (err.errorNum !== 942) {
        throw err;
      }
    }
    await connection.execute(
      `CREATE TABLE ${tableName} (` +
      'id NUMBER PRIMARY KEY, name VARCHAR2(100), payload CLOB, ' +
      'created_at TIMESTAMP)'
    );
  });

  after(async function() {
    if (connection) {
      if (isRunnable) {
        await connection.execute(`DROP TABLE ${tableName} PURGE`);
      }
      await connection.close();
    }
  });

  it('329.1 connects in Thin mode and reports the 11g server version',
    async function() {
      assert.strictEqual(oracledb.thin, true);
      assert.match(connection.oracleServerVersionString, /^11\.2\./);

      const result = await connection.execute('SELECT 1 FROM DUAL');
      assert.deepStrictEqual(result.rows, [[1]]);
    });

  it('329.2 supports binds, DML, executeMany, commit, and rollback',
    async function() {
      let result = await connection.execute(
        `INSERT INTO ${tableName} (id, name) VALUES (:id, :name)`,
        {id: 1, name: 'committed'}
      );
      assert.strictEqual(result.rowsAffected, 1);
      await connection.commit();

      await connection.execute(
        `INSERT INTO ${tableName} (id, name) VALUES (2, 'rolled back')`
      );
      await connection.rollback();

      result = await connection.executeMany(
        `INSERT INTO ${tableName} (id, name) VALUES (:1, :2)`,
        [[3, 'three'], [4, 'four']],
        {autoCommit: true}
      );
      assert.strictEqual(result.rowsAffected, 2);

      result = await connection.execute(
        `SELECT id, name FROM ${tableName} ORDER BY id`
      );
      assert.deepStrictEqual(result.rows,
        [[1, 'committed'], [3, 'three'], [4, 'four']]);
    });

  it('329.3 supports CLOB locators, timestamps, and PL/SQL OUT binds',
    async function() {
      const timestamp = new Date('2026-08-07T00:00:00Z');
      await connection.execute(
        `UPDATE ${tableName} ` +
        'SET payload = :payload, created_at = :created_at WHERE id = 1',
        {payload: '11g CLOB', created_at: timestamp},
        {autoCommit: true}
      );

      let result = await connection.execute(
        `SELECT payload, created_at FROM ${tableName} WHERE id = 1`
      );
      assert.strictEqual(await result.rows[0][0].getData(), '11g CLOB');
      assert(result.rows[0][1] instanceof Date);

      result = await connection.execute(
        'BEGIN :out_value := :in_value + 1; END;',
        {
          out_value: {dir: oracledb.BIND_OUT, type: oracledb.NUMBER},
          in_value: 41
        }
      );
      assert.strictEqual(result.outBinds.out_value, 42);
    });

  it('329.4 supports the legacy CLR format for values over 252 bytes',
    async function() {
      const suffix = 'NULL; END;';
      const sql = 'BEGIN ' + ' '.repeat(300 - 6 - suffix.length) + suffix;
      await connection.execute(sql);

      const value = 'x'.repeat(1000);
      const result = await connection.execute(
        'SELECT :value FROM DUAL', {value}
      );
      assert.strictEqual(result.rows[0][0], value);
    });

  it('329.5 decodes pre-12.1 Oracle errors', async function() {
    await assert.rejects(
      async () => await connection.execute(
        'SELECT * FROM nodb_thin11g_missing'
      ),
      err => err.code === 'ORA-00942' && err.errorNum === 942
    );
  });

  it('329.6 creates and uses a Thin mode pool', async function() {
    const pool = await oracledb.createPool({
      ...dbConfig,
      poolMin: 0,
      poolMax: 2
    });
    try {
      const pooledConnection = await pool.getConnection();
      try {
        const result = await pooledConnection.execute('SELECT 1 FROM DUAL');
        assert.deepStrictEqual(result.rows, [[1]]);
      } finally {
        await pooledConnection.close();
      }
    } finally {
      await pool.close(0);
    }
  });

  it('329.7 rejects unsupported advanced DML response modes',
    async function() {
      const sql = `INSERT INTO ${tableName} (id, name) VALUES (:1, :2)`;
      const binds = [[10, 'ten']];

      await assert.rejects(
        async () => await connection.executeMany(
          sql, binds, {dmlRowCounts: true}
        ),
        /NJS-089:.*DML row counts/
      );
      await assert.rejects(
        async () => await connection.executeMany(
          sql, binds, {batchErrors: true}
        ),
        /NJS-089:.*batch errors/
      );
    });

  it('329.8 connects with SYSDBA privilege', async function() {
    if (!dbConfig.test.DBA_PRIVILEGE) {
      this.skip();
    }

    const dbaConnection = await oracledb.getConnection({
      user: dbConfig.test.DBA_user,
      password: dbConfig.test.DBA_password,
      connectString: dbConfig.connectString,
      privilege: oracledb.SYSDBA
    });
    try {
      const result = await dbaConnection.execute(
        "SELECT SYS_CONTEXT('USERENV', 'SESSION_USER'), " +
        "SYS_CONTEXT('USERENV', 'ISDBA') FROM DUAL"
      );
      assert.deepStrictEqual(result.rows, [['SYS', 'TRUE']]);
    } finally {
      await dbaConnection.close();
    }
  });
});
