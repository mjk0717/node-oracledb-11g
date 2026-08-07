# node-oracledb 7.1.0-11g-thin.2 (unofficial fork)

> [!IMPORTANT]
> This is an independently maintained, unofficial fork of
> [Oracle's node-oracledb project](https://github.com/oracle/node-oracledb).
> It is not maintained, endorsed, or supported by Oracle. The Oracle Database
> 11g Thin compatibility path is experimental.

The node-oracledb add-on for Node.js powers high performance Oracle Database
applications.  Applications can be written in TypeScript, or directly in
JavaScript.

Use this fork with Node.js 14.17, or later, to connect to Oracle
Database.  Older versions of node-oracledb may work with older versions of
Node.js.

Node-oracledb supports basic and advanced features of Oracle Database
and Oracle Client.  See the [homepage][4] for a list. It is used by many
JavaScript and TypeScript frameworks, SQL generators, ORMs, and libraries.

Node-oracledb has a rich feature set which is easy to use. It gives you
control over SQL and PL/SQL statement execution, fast data ingestion, support
for calling NoSQL-style document APIs, message queueing,database notifications
and for starting and stopping the database.
It also has high availability and security features. Database operations
can optionally be [pipelined][16].

The upstream node-oracledb module is open source and maintained by Oracle.
This fork is maintained independently by
[mjk0717](https://github.com/mjk0717) and adds experimental Oracle Database
11g Release 2 Thin compatibility to the upstream codebase.

## Installation

This fork is not published to the npm registry. Running
`npm install oracledb` installs Oracle's upstream package, not this fork.
Install the GitHub Release package as described in
[Installing This Fork Without the npm Registry](#installing-this-fork-without-the-npm-registry).

See [Getting Started with Node-oracledb][1] and [Quick Start Node-oracledb Installation][2].

## Dependencies and Interoperability

- Node.js versions 14.17 and later.

  Pre-built packages are available on [npm][14] and other mirror repositories.

  Source code is also available.

  Previous versions of node-oracledb supported older Node.js versions.

- Oracle Client libraries are *optional* starting from node-oracledb 6.0.
  Older versions of node-oracledb require Oracle Client libraries.

  **Thin mode**: By default node-oracledb (from version 6.0 onwards) runs in a
  'Thin' mode which connects directly to Oracle Database.

  **Thick mode**: Some advanced Oracle Database functionality is currently only
  available when optional Oracle Client libraries are loaded by
  node-oracledb. Libraries are available in the free [Oracle Instant
  Client][15] packages. Node-oracledb can use Oracle Client libraries version
  19 or later. Older node-oracledb versions supported older Client
  versions.

- Oracle Database

  **Thin mode**: Oracle Database 12.1 (or later) is supported. This fork also
  provides experimental TCP password-authentication support for Oracle
  Database 11g Release 2, including SYSDBA connections. The compatibility path
  is tested with Oracle Database XE 11.2.0.2. TCPS, external authentication,
  batch errors, DML row counts, and direct CLOB-to-STRING fetch conversion are
  not supported on this path.

  **Thick mode**: Oracle Database 11.2 (or later) is required, depending on the
  Oracle Client library version.  Oracle Database's standard client-server
  version interoperability allows connection to both older and newer
  databases. For example, when node-oracledb uses Oracle Client 19c libraries,
  then it can connect to Oracle Database 11.2 or later.

## Oracle Database 11g Thin Compatibility

This fork's 11g path is intended for Oracle Database 11g Release 2 over TCP
using database password authentication. It has been integration-tested with
Oracle Database XE 11.2.0.2. Oracle Database 11.2.0.4 has not yet been tested
against this fork.

The tested surface includes SQL queries, binds, DML, `executeMany()`,
transactions, connection pools, CLOB locators, timestamps, PL/SQL OUT binds,
Oracle error decoding, and SYSDBA authentication. For CLOB values, fetch a LOB
locator and call `getData()`.

Use the `privilege` connection property for SYSDBA:

```javascript
const oracledb = require('oracledb');

const connection = await oracledb.getConnection({
  user: 'sys',
  password: process.env.ORACLE_PASSWORD,
  connectString: '127.0.0.1:1521/XE',
  privilege: oracledb.SYSDBA
});

try {
  const result = await connection.execute(
    "SELECT SYS_CONTEXT('USERENV', 'ISDBA') FROM DUAL"
  );
  console.log(result.rows); // [["TRUE"]]
} finally {
  await connection.close();
}
```

The 11g path rejects TCPS, external authentication, `batchErrors`, and
`dmlRowCounts`. These restrictions do not change the Oracle Database 12.1 and
later Thin paths.

## Installing This Fork Without the npm Registry

Install the tagged source archive directly from GitHub:

```shell
npm install "https://github.com/mjk0717/node-oracledb-11g/archive/refs/tags/v7.1.0-11g-thin.2.tar.gz"
```

Alternatively, install the npm package archive attached to the GitHub Release:

```shell
npm install "https://github.com/mjk0717/node-oracledb-11g/releases/download/v7.1.0-11g-thin.2/oracledb-7.1.0-11g-thin.2.tgz"
```

After downloading the archive, it can also be installed from a local path:

```shell
npm install "./oracledb-7.1.0-11g-thin.2.tgz"
```

## Documentation

See [Documentation for the Oracle Database Node.js Add-on][9] and the [release
notes][10].

## Examples

See the [examples][7] directory.  Start with [examples/example.js][8].

## Help

Questions and issues with node-oracledb can be posted on [GitHub][3] or
[Slack][5] ([link to join Slack][6]).

## <a name="testing"></a> Tests

To run the test suite, see [test/README][11].

## Contributing

This project welcomes contributions from the community. Before submitting a
pull request, please [review our contribution guide][12].

## Security

Please consult the [security guide][13] for our responsible security
vulnerability disclosure process.

## License

Copyright (c) 2015, 2026, Oracle and/or its affiliates.

Modifications Copyright (c) 2026, mjk0717.

The original license notices, `NOTICE.txt`, and `THIRD_PARTY_LICENSES.txt` are
retained in this repository and in the packaged release. The names Oracle and
node-oracledb are used here only to identify the upstream project and the
compatible database product; their use does not imply endorsement.

This software is dual-licensed to you under the Universal Permissive License
(UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
either license.

If you elect to accept the software under the Apache License, Version 2.0,
the following applies:

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

[1]: https://node-oracledb.readthedocs.io/en/latest/user_guide/introduction.html#getstarted
[2]: https://node-oracledb.readthedocs.io/en/latest/user_guide/installation.html#quickstart
[3]: https://github.com/mjk0717/node-oracledb-11g/issues
[4]: https://oracle.github.io/node-oracledb
[5]: https://node-oracledb.slack.com/
[6]: https://join.slack.com/t/node-oracledb/shared_invite/enQtNDU4Mjc2NzM5OTA2LWMzY2ZlZDY5MDdlMGZiMGRkY2IzYjI5OGU4YTEzZWM5YjQ3ODUzMjcxNWQyNzE4MzM5YjNkYjVmNDk5OWU5NDM
[7]: https://github.com/oracle/node-oracledb/blob/main/examples
[8]: https://github.com/oracle/node-oracledb/blob/main/examples/example.js
[9]: https://node-oracledb.readthedocs.io/en/latest/
[10]: https://node-oracledb.readthedocs.io/en/latest/release_notes.html
[11]: https://github.com/oracle/node-oracledb/blob/main/test/README.md
[12]: https://github.com/oracle/node-oracledb/blob/main/CONTRIBUTING.md
[13]: https://github.com/oracle/node-oracledb/blob/main/SECURITY.md
[14]: https://www.npmjs.com/package/oracledb
[15]: https://www.oracle.com/database/technologies/instant-client.html
[16]: https://node-oracledb.readthedocs.io/en/latest/user_guide/pipeline.html
