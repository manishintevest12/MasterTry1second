const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({ host: '127.0.0.1', user: 'root', password: '', database: 'try1second', multipleStatements: false }).catch(async e => {
    return mysql.createConnection({ host: '127.0.0.1', user: 'root', password: 'root', database: 'try1second' });
  });
  const [tables] = await c.query('SHOW TABLES');
  const names = tables.map(r => Object.values(r)[0]);
  console.log('tables:', names.join(', '));
  for (const t of names) {
    const [cols] = await c.query(`SHOW COLUMNS FROM \`${t}\``);
    const urlCols = cols.filter(c2 => /url|link|dest/i.test(c2.Field)).map(c2 => c2.Field);
    if (!urlCols.length) continue;
    for (const col of urlCols) {
      try {
        const [rows] = await c.query(`SELECT COUNT(*) n FROM \`${t}\` WHERE \`${col}\` LIKE '%blogvetter%' OR \`${col}\` LIKE '%/api/out?t=%'`);
        if (rows[0].n > 0) console.log('HIT', t, col, rows[0].n);
      } catch {}
    }
  }
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
