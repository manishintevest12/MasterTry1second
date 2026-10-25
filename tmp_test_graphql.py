import json
from curl_cffi import requests

headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://in.gotogate.com',
    'referer': 'https://in.gotogate.com/',
    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
}

# 1. Test GetNearbyDatePrices
gql_nearby = {
    "operationName": "GetNearbyDatePrices",
    "variables": {
        "departureDate": "2026-10-28",
        "returnDate": None,
        "origin": "DEL",
        "destination": "BOM",
        "numOfDays": 7
    },
    "query": """query GetNearbyDatePrices(
        $departureDate: String!
        $returnDate: String
        $origin: String!
        $destination: String!
        $numOfDays: Int!
    ) {
        nearbyDatePrices(
            departureDate: $departureDate
            returnDate: $returnDate
            origin: $origin
            destination: $destination
            numOfDays: $numOfDays
        ) {
            departureDate
            returnDate
            isCheapest
            isSelected
            price {
                value
                currency {
                    code
                    exponent
                    name
                }
            }
        }
    }"""
}

print("--- Testing GetNearbyDatePrices on in.gotogate.com ---")
r = requests.post("https://in.gotogate.com/graphql", json=gql_nearby, headers=headers, impersonate="chrome")
print("Status:", r.status_code)
print("Response:", r.text[:1000])

