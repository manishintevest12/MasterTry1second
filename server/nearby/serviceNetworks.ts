/**
 * SERVICE NETWORKS (owner 17 Nov: "ye sb mai results aana compulsory hai, agar results ni aa raha tho empty show ni
 * kre").
 *
 * Open map data simply does not have a named battery shop, detailing studio or scrapyard in most Indian cities, so
 * a chip could end on "nothing here". These are the real businesses that DO serve every Indian city in each of those
 * errands - the workshop chains, the brand dealer locators, the government portals. They are shown only when the
 * city has no mapped place of its own, and always labelled as a network that covers the city, never as a specific
 * shop with an invented address or rating.
 *
 * Same pattern the Cab tab already uses for Uber/Ola/Rapido. Every link is the brand's own site - no affiliate
 * redirect hidden behind a name.
 */

export interface ServiceNetwork {
  name: string;
  url: string;
  sub: string;
}

export const SERVICE_NETWORKS: Record<string, ServiceNetwork[]> = {
  /**
   * OWNER 17 Nov (screenshot: Cinemas and Stores tabs showed "No places came back for this location right now"):
   * open map data for Indore answered nothing inside the budget, so those two tabs - the most ordinary errands on the
   * site - were the only ones that could end empty. Same rule as the vehicle chips: a real business that covers the
   * city, opening its own page, never an invented address.
   */
  movies: [
    { name: 'PVR INOX', url: 'https://www.pvrcinemas.com/', sub: 'cinema chain' },
    { name: 'BookMyShow', url: 'https://in.bookmyshow.com/explore/cinemas', sub: 'cinema listings' },
    { name: 'Cinepolis India', url: 'https://www.cinepolisindia.com/', sub: 'cinema chain' },
    { name: 'Miraj Cinemas', url: 'https://www.mirajcinemas.com/', sub: 'cinema chain' },
    { name: 'MovieMax', url: 'https://www.moviemax.co.in/', sub: 'cinema chain' },
  ],
  stores: [
    { name: 'DMart', url: 'https://www.dmart.in/', sub: 'supermarket chain' },
    { name: 'Reliance Smart Bazaar', url: 'https://www.relianceretail.com/', sub: 'supermarket chain' },
    { name: 'Croma', url: 'https://www.croma.com/', sub: 'electronics chain' },
    { name: 'Vijay Sales', url: 'https://www.vijaysales.com/', sub: 'electronics chain' },
    { name: 'Decathlon India', url: 'https://www.decathlon.in/', sub: 'sports store chain' },
    { name: 'Reliance Digital', url: 'https://www.reliancedigital.in/', sub: 'electronics chain' },
  ],
  petrol: [
    { name: 'Indian Oil (IOCL)', url: 'https://www.iocl.com/find-us', sub: 'fuel station network' },
    { name: 'Bharat Petroleum (BPCL)', url: 'https://www.bharatpetroleum.in/our-businesses/fuel-stations', sub: 'fuel station network' },
    { name: 'HPCL', url: 'https://www.hindustanpetroleum.com/locate-us', sub: 'fuel station network' },
    { name: 'Nayara Energy', url: 'https://www.nayaraenergy.com/our-businesses/marketing/fuel-stations', sub: 'fuel station network' },
    { name: 'Shell India', url: 'https://www.shell.in/motorists/shell-fuels/station-locator.html', sub: 'fuel station network' },
    { name: 'Jio-bp', url: 'https://www.jiobp.com/find-a-station', sub: 'fuel station network' },
  ],
  cng: [
    { name: 'IGL CNG stations', url: 'https://www.iglonline.net/English/OurNetwork.aspx', sub: 'CNG network' },
    { name: 'Adani Total Gas', url: 'https://www.adanitotalgas.com/cng-stations', sub: 'CNG network' },
    { name: 'Torrent Gas', url: 'https://www.torrentgas.com/cng-stations', sub: 'CNG network' },
    { name: 'GAIL Gas', url: 'https://www.gailgas.com/cng-stations', sub: 'CNG network' },
  ],
  lpg: [
    { name: 'Indane (IOCL)', url: 'https://www.indane.co.in/', sub: 'LPG distributor network' },
    { name: 'Bharatgas (BPCL)', url: 'https://www.ebharatgas.com/', sub: 'LPG distributor network' },
    { name: 'HP Gas (HPCL)', url: 'https://www.hpgas.in/', sub: 'LPG distributor network' },
  ],
  car_repair: [
    { name: 'GoMechanic', url: 'https://gomechanic.in/', sub: 'car service network' },
    { name: 'MyTVS', url: 'https://www.mytvs.in/', sub: 'car service network' },
    { name: 'Bosch Car Service', url: 'https://www.bosch-service.com/in/en.html', sub: 'multi-brand workshop network' },
    { name: 'Maruti Suzuki Service', url: 'https://www.marutisuzuki.com/service', sub: 'authorised service network' },
    { name: 'Hyundai Service', url: 'https://www.hyundai.com/in/en/service', sub: 'authorised service network' },
  ],
  bike_repair: [
    { name: 'Hero MotoCorp Service', url: 'https://www.heromotocorp.com/en-in/service.html', sub: 'two-wheeler service network' },
    { name: 'Honda 2Wheelers Service', url: 'https://www.honda2wheelersindia.com/service', sub: 'two-wheeler service network' },
    { name: 'TVS Service', url: 'https://www.tvsmotor.com/service', sub: 'two-wheeler service network' },
    { name: 'Bajaj Auto Service', url: 'https://www.bajajauto.com/service', sub: 'two-wheeler service network' },
    { name: 'Royal Enfield Service', url: 'https://www.royalenfield.com/in/en/service/', sub: 'two-wheeler service network' },
  ],
  puncture: [
    { name: 'MRF dealer locator', url: 'https://www.mrftyres.com/dealer-locator', sub: 'tyre & puncture dealers' },
    { name: 'Apollo Tyres dealers', url: 'https://www.apollotyres.com/en-in/find-a-dealer/', sub: 'tyre & puncture dealers' },
    { name: 'CEAT dealers', url: 'https://www.ceat.com/dealer-locator.html', sub: 'tyre & puncture dealers' },
    { name: 'JK Tyre dealers', url: 'https://www.jktyre.com/dealer-locator.aspx', sub: 'tyre & puncture dealers' },
  ],
  battery: [
    { name: 'Exide dealers', url: 'https://www.exideindustries.com/dealer-locator.aspx', sub: 'battery dealer network' },
    { name: 'Amaron (Amara Raja)', url: 'https://www.amarabatteries.com/', sub: 'battery dealer network' },
    { name: 'Livguard', url: 'https://www.livguard.com/find-a-dealer/', sub: 'battery dealer network' },
    { name: 'Luminous', url: 'https://www.luminousindia.com/find-dealer', sub: 'battery & inverter network' },
    { name: 'SF Sonic', url: 'https://www.sfsonic.com/', sub: 'battery dealer network' },
  ],
  tyres: [
    { name: 'MRF dealer locator', url: 'https://www.mrftyres.com/dealer-locator', sub: 'tyre dealer network' },
    { name: 'Apollo Tyres dealers', url: 'https://www.apollotyres.com/en-in/find-a-dealer/', sub: 'tyre dealer network' },
    { name: 'CEAT dealers', url: 'https://www.ceat.com/dealer-locator.html', sub: 'tyre dealer network' },
    { name: 'JK Tyre dealers', url: 'https://www.jktyre.com/dealer-locator.aspx', sub: 'tyre dealer network' },
    { name: 'Michelin India', url: 'https://www.michelin.in/auto/dealers', sub: 'tyre dealer network' },
  ],
  denting: [
    { name: 'GoMechanic denting & painting', url: 'https://gomechanic.in/', sub: 'body shop network' },
    { name: 'MyTVS body repair', url: 'https://www.mytvs.in/', sub: 'body shop network' },
    { name: 'Maruti Suzuki body shop', url: 'https://www.marutisuzuki.com/service/body-shop', sub: 'authorised body shop network' },
    { name: 'Bosch Car Service', url: 'https://www.bosch-service.com/in/en.html', sub: 'body repair network' },
  ],
  accessories: [
    { name: 'Maruti Genuine Accessories', url: 'https://www.marutisuzuki.com/accessories', sub: 'car accessory network' },
    { name: 'Hyundai Accessories', url: 'https://www.hyundai.com/in/en/accessories', sub: 'car accessory network' },
    { name: 'Amazon Car & Motorbike store', url: 'https://www.amazon.in/b?node=5257472031', sub: 'online accessory store' },
    { name: 'Flipkart Automobile store', url: 'https://www.flipkart.com/automotive', sub: 'online accessory store' },
  ],
  car_wash: [
    { name: '3M Car Care', url: 'https://www.3mindia.in/en/car-care', sub: 'car care network' },
    { name: 'CarzSpa', url: 'https://www.carzspa.com/', sub: 'car wash network' },
    { name: 'GoMechanic car wash', url: 'https://gomechanic.in/', sub: 'car wash network' },
  ],
  detailing: [
    { name: '3M Car Care', url: 'https://www.3mindia.in/en/car-care', sub: 'detailing network' },
    { name: 'CarzSpa', url: 'https://www.carzspa.com/', sub: 'detailing network' },
    { name: 'Detailing Devils', url: 'https://www.detailingdevils.com/', sub: 'detailing studio network' },
  ],
  pucc: [
    { name: 'Parivahan PUC centre locator', url: 'https://parivahan.gov.in/', sub: 'PUCC issuing centres' },
    { name: 'Indian Oil PUC at pumps', url: 'https://www.iocl.com/find-us', sub: 'PUCC at fuel stations' },
    { name: 'BPCL PUC centres', url: 'https://www.bharatpetroleum.in/our-businesses/fuel-stations', sub: 'PUCC at fuel stations' },
    { name: 'HPCL PUC centres', url: 'https://www.hindustanpetroleum.com/locate-us', sub: 'PUCC at fuel stations' },
  ],
  insurance: [
    { name: 'LIC of India', url: 'https://licindia.in/branch-locator', sub: 'insurance office network' },
    { name: 'ICICI Lombard', url: 'https://www.icicilombard.com/', sub: 'motor insurance network' },
    { name: 'HDFC ERGO', url: 'https://www.hdfcergo.com/', sub: 'motor insurance network' },
    { name: 'Bajaj Allianz', url: 'https://www.bajajallianz.com/', sub: 'motor insurance network' },
    { name: 'New India Assurance', url: 'https://www.newindia.co.in/', sub: 'public insurer network' },
  ],
  rto: [
    { name: 'Parivahan (Ministry of Road Transport)', url: 'https://parivahan.gov.in/', sub: 'RTO services portal' },
    { name: 'Sarathi DL / RTO services', url: 'https://sarathi.parivahan.gov.in/', sub: 'RTO services portal' },
    { name: 'Vahan vehicle registry', url: 'https://vahan.parivahan.gov.in/', sub: 'RTO services portal' },
  ],
  bike_rental: [
    { name: 'Royal Brothers', url: 'https://www.royalbrothers.com/', sub: 'bike rental network' },
    { name: 'ONN Bikes', url: 'https://www.onnbikes.com/', sub: 'bike rental network' },
    { name: 'Bounce', url: 'https://www.bounceshare.com/', sub: 'scooter rental network' },
    { name: 'Wicked Ride', url: 'https://www.wickedride.com/', sub: 'premium bike rental network' },
  ],
  car_rental: [
    { name: 'Zoomcar', url: 'https://www.zoomcar.com/', sub: 'self-drive car rental' },
    { name: 'Revv', url: 'https://www.revv.co.in/', sub: 'self-drive car rental' },
    { name: 'Avis India', url: 'https://www.avis.co.in/', sub: 'car rental network' },
    { name: 'MyChoize', url: 'https://www.mychoize.com/', sub: 'self-drive car rental' },
    { name: 'Europcar India', url: 'https://www.europcar.co.in/', sub: 'car rental network' },
  ],
  scrapping: [
    { name: 'Parivahan RVSF list', url: 'https://parivahan.gov.in/', sub: 'registered scrapping facilities' },
    { name: 'Mahindra CERO', url: 'https://www.mahindracero.com/', sub: 'vehicle scrapping network' },
    { name: 'Maruti Suzuki scrappage', url: 'https://www.marutisuzuki.com/vehicle-scrappage', sub: 'vehicle scrapping network' },
    { name: 'Tata Motors scrappage', url: 'https://www.tatamotors.com/', sub: 'vehicle scrapping network' },
  ],
};

/** The networks that cover a city for a category, or an empty list for the original eight categories. */
export function serviceNetworks(category: string): ServiceNetwork[] {
  return SERVICE_NETWORKS[String(category || '')] || [];
}
