import { createMaskingPointer, resolveMaskingPointer } from '../server/affiliate/deeplink';
const p = createMaskingPointer(process.argv[2] || 'https://www.dpbolvw.net/x?url=https%3A%2F%2Fx.com');
const token = p.replace(/^\/api\/out\?t=/, '');
const back = resolveMaskingPointer(token);
console.log('token ok:', !!back, '| dest:', back?.destination?.slice(0, 60));
if (back) console.log('url:', `http://localhost:3312${p}`);
