import { buildSecureDeeplink } from '../server/affiliate/deeplink';
import { appInstallExit, appInstallExitEnabled } from '../server/affiliate/appCampaigns';
process.env.T1S_APP_INSTALL_EXITS = 'all';
for (const u of ['https://www.easemytrip.com/hotels/', 'https://www.easemytrip.com/flights/']) {
  const r: any = await buildSecureDeeplink(u);
  console.log(u);
  console.log('  exit network=', r.network, 'profile=', r.matchedProfile);
  console.log('  deep path kept=', String(r.trackingUrl).includes(encodeURIComponent(u)));
  console.log('  install exit=', appInstallExit(u, { isAndroid: true }), '| install enabled=', appInstallExitEnabled('easemytrip'));
}
