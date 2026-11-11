/** Proves a photo-sized JSON body survives the upload routes while the global 256kb guard still holds. */
import express from 'express';
import { lenientJsonBody } from '../server/common/lenientJson';
const app = express();
app.use(['/api/admin/merchant-logos'], lenientJsonBody('2mb'));
app.use(lenientJsonBody('256kb'));
app.post('/api/admin/merchant-logos', (req: any, res) => res.json({ gotBytes: String(req.body?.logo || '').length }));
app.post('/api/other', (req: any, res) => res.json({ gotBytes: String(req.body?.pad || '').length }));
const server = app.listen(0);
const port = (server.address() as any).port;
const big = 'x'.repeat(700_000);
const post = async (path: string, body: any) => {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return `${path} -> ${r.status} ${await r.text()}`;
};
console.log(await post('/api/admin/merchant-logos', { name: 'x', logo: big }));
console.log(await post('/api/other', { pad: big }));
server.close();
