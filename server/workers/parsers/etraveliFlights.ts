// Etraveli Group flights (Gotogate / FlightNetwork) — owner OTA expansion (25 Oct).
//
// Recipe (captured from the brand SPA's own GraphQL XHR via request interception,
// replayed BROWSERLESS with curl_cffi — verified live from the sandbox):
//   POST https://in.gotogate.com/graphql/SearchOnResultPage        (INR storefront)
//   POST https://in.flightnetwork.com/graphql/SearchOnResultPage   (INR storefront)
//   Body: { operationName: "SearchOnResultPage", variables, query } where the
//   query document is embedded verbatim below (no persisted-query hash, no
//   session, no tokens). Variables:
//     { adults: 1, cabinClass: "ECONOMY", childAges: [], filters: [],
//       routes: [{ origin: "DEL", destination: "BOM", departureDate: "2026-10-28" }],
//       sortTypeCode: "BEST_VALUE", offset: <0|10|20...> }
//   10 flights per page (offset pagination; flightsCount reports the total).
//   Verified: DEL-BOM 28 Oct — in.gotogate.com 78 flights, in.flightnetwork.com
//   82 flights, real INR fares (Akasa QP1805 Rs 7,833 all-inclusive).
//
// Response shape (per flight):
//   travelerPrices[0].price.price.{value, currency.code} — value in MINOR units
//     (paise/cents; 783300 = Rs 7,833.00) — divide by 100.
//   bounds[0].segments[]: { flightNumber, marketingCarrier: {code, name},
//     origin: {code, cityCode}, destination: {code, cityCode, cityName},
//     departuredAt, arrivedAt, duration (ms), cabinClassName, aircraftType }
//   shareableUrl — the brand's own deeplink WITH the per-itinerary
//     selectionKey baked in (lands on the result page with the trip selected).
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { repairEtraveliDeeplink } from '../../affiliate/deeplinkDate';

export const ETRAVELI_QUERY = `query SearchOnResultPage($routes: [Route!]!, $cabinClass: CabinClass, $direct: Boolean, $carrierCodes: [String], $adults: Int!, $childAges: [Int], $offset: Int, $sortTypeCode: String, $filters: [Filter!], $validWithVoucher: Boolean) {
  search(
    routes: $routes
    cabinClass: $cabinClass
    direct: $direct
    carrierCodes: $carrierCodes
    adults: $adults
    childAges: $childAges
    offset: $offset
    sortTypeCode: $sortTypeCode
    filters: $filters
    validWithVoucher: $validWithVoucher
  ) {
    availableFilters {
      code
      group
      label
      ... on RangeFilter {
        __typename
        code
        group
        label
        max
        min
        type
      }
      ... on SelectionFilter {
        __typename
        code
        group
        label
        isMultiChoice
        options {
          label
          value
          __typename
        }
        type
      }
      __typename
    }
    availableSortTypes {
      code
      name
      __typename
    }
    carrierCodes
    carrierNames
    flights {
      ...Flights
      __typename
    }
    flightsCount
    filteredFlightsCount
    quickSortPrices {
      carrierPromo {
        value
        currency {
          code
          __typename
        }
        __typename
      }
      cheapTrip {
        value
        currency {
          code
          __typename
        }
        __typename
      }
      shortTrip {
        value
        currency {
          code
          __typename
        }
        __typename
      }
      recommendation {
        value
        currency {
          code
          __typename
        }
        __typename
      }
      bestValue {
        value
        currency {
          code
          __typename
        }
        __typename
      }
      longStay {
        value
        currency {
          code
          __typename
        }
        __typename
      }
      __typename
    }
    resultSetMetaData {
      priceRange {
        min
        max
        __typename
      }
      travelTimeRange {
        min
        max
        __typename
      }
      marketingCarriers {
        code
        name
        logo {
          small
          large
          darkModeSmall
          darkModeLarge
          __typename
        }
        __typename
      }
      __typename
    }
    routes {
      origin {
        code
        name
        cityCode
        cityName
        countryCode
        countryName
        continentCode
        continentName
        __typename
      }
      destination {
        code
        name
        cityCode
        cityName
        countryCode
        countryName
        continentCode
        continentName
        __typename
      }
      departureAt
      departureDate
      departureTimeOfDay
      __typename
    }
    searchPath
    sponsoredTrips {
      ...Flights
      __typename
    }
    travelers {
      ageType
      __typename
    }
    type
    tripCampaigns {
      campaignImageUrlDesktop
      campaignImageUrlMobile
      selectionKey
      __typename
    }
    validWithVoucher
    __typename
  }
}

fragment IncludedCabinBaggage on IncludedCabinBaggage {
  pieces
  weight
  weightUnit
  __typename
}

fragment IncludedCheckedBaggage on IncludedCheckedBaggage {
  pieces
  weight
  weightUnit
  __typename
}

fragment AvailableExtraProducts on ExtraProduct {
  configuration {
    productPreSelection
    __typename
  }
  productId: id
  name
  selectedWithTrip
  productSpecificTexts {
    ... on PriceLockText {
      __typename
      lockPeriod {
        unit
        value
        unitCode
        __typename
      }
    }
    __typename
  }
  sellSpecification {
    ... on SellSpecificationTravelerExternalChoiceNew {
      preselectedChoice
      externalChoices {
        ... on DistribusionChoice {
          externalChoiceId
          ancillaryOption
          distribusionChoiceBoundData {
            arrivalDateTime
            arrivalStation
            boundAndSegmentIndices {
              boundIndex
              segmentIndex
              __typename
            }
            departureDateTime
            departureStation
            fareClass
            transferCarrier
            transferCarrierLogo
            termsAndConditions
            transferTime
            transferType
            validityReferenceTimeType
            validityDurationType
            validityDuration
            __typename
          }
          pricePerTravelers {
            price {
              price {
                value
                __typename
              }
              __typename
            }
            travelerId
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    ... on SellSpecificationTravelerNew {
      sellPriceTravelers {
        price {
          price {
            value
            __typename
          }
          markup {
            value
            __typename
          }
          vat {
            value
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    ... on SellSpecificationNoneNew {
      price {
        price {
          value
          currency {
            code
            exponent
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    ... on SellSpecificationBaggageNew {
      sellPriceBaggage {
        travelerId
        hasMultipleWeightOptions
        options {
          numberOfUnits
          weight
          weightUnit
          preselected
          ancillaryCarrierPriceBreakdowns {
            carrier {
              code
              name
              __typename
            }
            providerPrice {
              value
              __typename
            }
            __typename
          }
          price {
            markup {
              value
              __typename
            }
            price {
              value
              __typename
            }
            vat {
              value
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    ... on SellCabinBaggageNew {
      weight
      weightUnit
      pieces
      size3d {
        height
        length
        width
        __typename
      }
      sellPriceTravelers {
        travelerId
        price {
          markup {
            value
            currency {
              code
              exponent
              name
              __typename
            }
            __typename
          }
          price {
            value
            currency {
              code
              exponent
              name
              __typename
            }
            __typename
          }
          vat {
            currency {
              code
              exponent
              name
              __typename
            }
            value
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
  __typename
}

fragment PaymentMethodPrices on PaymentMethodPrice {
  code
  name
  price {
    value
    __typename
  }
  type
  __typename
}

fragment TravelerPrices on TravelerPrice {
  id
  price {
    markup {
      value
      __typename
    }
    price {
      value
      currency {
        code
        __typename
      }
      __typename
    }
    vat {
      value
      __typename
    }
    __typename
  }
  taxesAndFees {
    category
    taxes {
      code
      title
      amount {
        value
        __typename
      }
      __typename
    }
    __typename
  }
  travelerId
  __typename
}

fragment Flights on Trip {
  id
  tripId
  isVI
  includedCabinBaggage {
    includedPersonalItem
    size3d {
      height
      length
      width
      __typename
    }
    ...IncludedCabinBaggage
    __typename
  }
  includedCheckedBaggage {
    ...IncludedCheckedBaggage
    __typename
  }
  bounds {
    boundId: id
    includedCabinBaggage {
      ...IncludedCabinBaggage
      __typename
    }
    includedCheckedBaggage {
      ...IncludedCheckedBaggage
      __typename
    }
    segments {
      ... on TripSegment {
        __typename
        segmentId: id
        aircraftType
        arrivedAt
        brandedFareInformation {
          name
          __typename
        }
        includedCabinBaggage {
          ...IncludedCabinBaggage
          __typename
        }
        includedCheckedBaggage {
          ...IncludedCheckedBaggage
          __typename
        }
        brandedFareInformation {
          name
          __typename
        }
        cabinClassName
        departuredAt
        destination {
          code
          name
          cityCode
          cityName
          airportCode
          airportName
          __typename
        }
        duration
        equipmentCode
        flightNumber
        marketingCarrier {
          code
          name
          logo {
            small
            large
            darkModeSmall
            darkModeLarge
            __typename
          }
          __typename
        }
        ticketingCarrier {
          code
          name
          __typename
        }
        numberOfTechnicalStops
        technicalStops {
          arrivalAt
          departureAt
          duration
          location {
            code
            name
            cityName
            cityCode
            __typename
          }
          __typename
        }
        operatingCarrier {
          code
          name
          logo {
            small
            large
            darkModeSmall
            darkModeLarge
            __typename
          }
          __typename
        }
        operatingInformation
        origin {
          code
          name
          cityCode
          cityName
          airportCode
          airportName
          __typename
        }
        segmentDetails {
          paxType
          numberOfSeatsLeft
          __typename
        }
      }
      ... on EventSegment {
        __typename
        segmentId: id
        types
        duration
      }
      __typename
    }
    __typename
  }
  brandedFares {
    name
    __typename
  }
  availableExtraProducts {
    ...AvailableExtraProducts
    __typename
  }
  includedExtraProducts {
    id
    texts {
      name
      productSummaryAlternativeName
      readMoreText
      receiptText
      salesAbstract
      __typename
    }
    __typename
  }
  selectionKey
  type
  tripCharacteristics
  tripTravelers: travelers {
    id
    ageType
    __typename
  }
  paymentMethodPrices {
    ...PaymentMethodPrices
    __typename
  }
  discountedPaymentMethodPrices {
    cheapestPaymentMethods {
      ...PaymentMethodPrices
      __typename
    }
    otherPaymentMethods {
      ...PaymentMethodPrices
      __typename
    }
    __typename
  }
  travelerPrices {
    ...TravelerPrices
    __typename
  }
  travelerPricesWithoutPaymentDiscounts {
    price {
      markup {
        value
        __typename
      }
      price {
        value
        currency {
          code
          __typename
        }
        __typename
      }
      vat {
        value
        __typename
      }
      __typename
    }
    taxesAndFees {
      category
      taxes {
        code
        title
        amount {
          value
          __typename
        }
        __typename
      }
      __typename
    }
    travelerId
    __typename
  }
  tripTags
  systems
  voucherAmount {
    value
    __typename
  }
  shareableUrl
  preferredDisplayCarrier
  __typename
}`;

export function etraveliSearchUrl(host: string): string {
  return `https://${host}/graphql/SearchOnResultPage`;
}

export interface EtraveliBrandConfig {
  host: string;
  brand: string;
}

export const GOTOGATE_IN: EtraveliBrandConfig = { host: 'in.gotogate.com', brand: 'Gotogate' };
export const FLIGHTNETWORK_IN: EtraveliBrandConfig = { host: 'in.flightnetwork.com', brand: 'FlightNetwork' };

/** Build the SearchOnResultPage POST body for a one-way INR search. */
export function etraveliSearchBody(
  brand: EtraveliBrandConfig,
  fromCode: string,
  toCode: string,
  dateIso: string,
  offset = 0,
): Record<string, unknown> {
  return {
    operationName: 'SearchOnResultPage',
    variables: {
      adults: 1,
      cabinClass: 'ECONOMY',
      childAges: [],
      filters: [],
      routes: [{ origin: fromCode, destination: toCode, departureDate: dateIso }],
      sortTypeCode: 'BEST_VALUE',
      ...(offset > 0 ? { offset } : {}),
    },
    query: ETRAVELI_QUERY,
  };
}

export interface EtraveliSegment {
  flightNumber?: string | number;
  marketingCarrier?: { code?: string; name?: string };
  origin?: { code?: string; cityCode?: string };
  destination?: { code?: string; cityCode?: string; cityName?: string };
  departuredAt?: string;
  arrivedAt?: string;
  duration?: number;
  cabinClassName?: string;
  aircraftType?: string;
}
export interface EtraveliFlight {
  id?: string | number;
  shareableUrl?: string;
  travelerPrices?: Array<{ price?: { price?: { value?: number; currency?: { code?: string } } } }>;
  bounds?: Array<{ segments?: EtraveliSegment[] }>;
}

/** Shape-tolerant parse: data.search.flights[] from a response. Never throws. */
export function parseEtraveliFlights(body: unknown): { flights: EtraveliFlight[]; flightsCount: number; searchPath?: string; error?: string } {
  const root = (body ?? {}) as Record<string, any>;
  if (root.errors && !root.data?.search) {
    return { flights: [], flightsCount: 0, error: String(root.errors?.[0]?.message || 'graphql error').slice(0, 160) };
  }
  const search = (root.data ?? {}).search;
  if (!search || typeof search !== 'object') return { flights: [], flightsCount: 0, error: 'no data.search in response' };
  const flights = Array.isArray(search.flights) ? search.flights.filter(Boolean) : [];
  const flightsCount = Number(search.flightsCount ?? 0) || flights.length;
  const searchPath = typeof search.searchPath === 'string' ? search.searchPath : undefined;
  return { flights, flightsCount, searchPath };
}

/** All-inclusive per-traveler fare in MAJOR units; NaN when absent/not-INR. */
export function etraveliFlightFare(f: EtraveliFlight): { fare: number; currency: string } {
  const price = f.travelerPrices?.[0]?.price?.price;
  const value = Number(price?.value);
  const currency = String(price?.currency?.code || '').toUpperCase();
  if (!Number.isFinite(value) || value <= 0) return { fare: NaN, currency };
  return { fare: value / 100, currency }; // minor units -> rupees
}

/**
 * Map flights to honest raw items. Only the requested route is kept (first
 * segment origin city + last segment destination city must match — DEL->BOM
 * also returns NMI (Navi Mumbai) rows which we keep via cityCode match), the
 * departure day must match, fares must be INR and sane; duplicates by
 * flight+time are collapsed. The shareableUrl (with selectionKey) is used as
 * the book deeplink when present, else the SRP path.
 */
export function etraveliFlightsItems(
  flights: EtraveliFlight[],
  brand: EtraveliBrandConfig,
  source: SourceConfig,
  route: { from: string; to: string },
  fromCode: string,
  toCode: string,
  dateIso: string,
  searchPath: string | undefined,
  cap = 40,
): RawSourceItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const routeLabel = `${route.from} → ${route.to}`;
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const f of flights) {
    if (out.length >= cap) break;
    const segs = (f.bounds?.[0]?.segments || []).filter(Boolean);
    if (segs.length === 0) continue;
    const oCode = String(segs[0].origin?.cityCode || segs[0].origin?.code || '');
    const dCode = String(segs[segs.length - 1].destination?.cityCode || segs[segs.length - 1].destination?.code || '');
    if (oCode !== fromCode || dCode !== toCode) continue; // wrong route dropped
    const depDay = String(segs[0].departuredAt || '').slice(0, 10);
    if (depDay !== dateIso) continue;
    const { fare, currency } = etraveliFlightFare(f);
    if (currency !== 'INR') continue; // never convert
    if (!Number.isFinite(fare) || fare < 500 || fare > 500000) continue;
    const carrierCode = String(segs[0].marketingCarrier?.code || '');
    const carrier = String(segs[0].marketingCarrier?.name || carrierCode || brand.brand);
    // flightNumber already carries the carrier prefix ("QP1805"), so concat
    // only when it is missing — avoids "QPQP1805" doubles.
    const flightNos = segs.map((s) => {
      const code = String(s.marketingCarrier?.code || '');
      const num = String(s.flightNumber || '');
      return num.startsWith(code) && code ? num : `${code}${num}`;
    }).join('-');
    const depTime = String(segs[0].departuredAt || '').slice(11, 16);
    const arrTime = String(segs[segs.length - 1].arrivedAt || '').slice(11, 16);
    const stops = segs.length - 1;
    const durMs = Number(segs[0].duration || 0) || Number(f.bounds?.[0]?.segments?.reduce?.((a: number, s: EtraveliSegment) => a + (Number(s.duration) || 0), 0) || 0);
    const dur = durMs > 0 ? Math.round(durMs / 60000) : undefined;
    const key = `${flightNos}|${depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const shareable = String(f.shareableUrl || '');
    // Owner 2 Nov: the row's own date is gated, but the exit link used to carry the day the
    // brand minted it for (a 19 Nov search produced /air/IDRDEL03NOV/ links showing 3 Nov
    // fares). Repair the link from the request so Book always opens the searched date.
    const deeplink = shareable.startsWith('http')
      ? repairEtraveliDeeplink(shareable, { fromCode, toCode, dateIso })
      : `https://${brand.host}${searchPath || '/rf/result'}`;
    out.push(newRawItem(source, {
      title: `${carrier} ${flightNos} · ${routeLabel}`.slice(0, 200),
      brand: carrier.slice(0, 80),
      price: Math.round(fare),
      currency: 'INR',
      seller: brand.brand,
      sellerUrl: deeplink,
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}`, date: dateIso, seatType: 'economy' },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        airline: carrier,
        airline_code: carrierCode,
        flight_number: flightNos,
        departure: depTime,
        arrival: arrTime,
        stops: String(stops),
        ...(dur ? { duration_minutes: String(dur) } : {}),
        ...(segs[0].cabinClassName ? { cabin: segs[0].cabinClassName } : {}),
        ...(segs[0].aircraftType ? { aircraft: String(segs[0].aircraftType).slice(0, 60) } : {}),
        price_basis: `live all-inclusive ${stops === 0 ? 'nonstop' : `${stops}-stop`} fare observed on ${brand.brand}'s flight search on ${today} (${brand.brand} is the selling website)`,
        data_note: `Fare acquired via ${brand.brand}'s SearchOnResultPage flight API on ${today}; the ticket is SOLD by ${brand.brand}. Price may change at checkout.`,
      },
      identifiers: { sku: `${brand.brand.toLowerCase()}-${flightNos}-${dateIso}-${depTime}`.slice(0, 120) },
      evidence: {
        sourceUrl: etraveliSearchUrl(brand.host),
        sourceReference: String(f.id || '').slice(0, 160),
        extractedFields: ['data.search.flights[].travelerPrices[0].price.price.value', 'bounds[0].segments[].marketingCarrier/flightNumber/departuredAt', 'shareableUrl'],
      },
    }));
  }
  return out;
}
