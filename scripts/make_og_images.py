#!/usr/bin/env python3
"""Per-vertical Open Graph cards for Try1Second (owner 19 Nov growth brief).

A shared link's preview is the only thing a friend sees on WhatsApp before deciding to tap, so each vertical
gets its own 1200x630 card instead of one generic banner. These are STATIC images on purpose: an image cannot
carry a live price honestly, so no card shows a number. The price, with its "seen <date>" label, is rendered by
the page itself (server/share/shareLinks.ts), which is the only place that knows when it was true.

Run from the repo root:  python3 scripts/make_og_images.py
Output:                  public/og/<vertical>.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (255, 255, 255)
INK = (15, 23, 42)
MUTED = (71, 85, 105)
SOFT = (100, 116, 139)
BRAND = (231, 0, 11)

# id, display name, one honest line, accent colour
VERTICALS = [
    ("flights", "Flights", "Non-stop and connecting fares, compared side by side", (14, 165, 233)),
    ("hotels", "Hotels", "Room rates across booking sites for the same stay", (139, 92, 246)),
    ("bus", "Bus", "Seat availability and fares on every operator", (34, 197, 94)),
    ("ecommerce", "E-Commerce", "The same product, every seller, lowest first", (231, 0, 11)),
    ("grocery", "10-Min Grocery", "Delivery prices and pack sizes, never swapped", (245, 158, 11)),
    ("food", "Food Delivery", "Delivery fees and offers across apps", (249, 115, 22)),
    ("movie", "Movies", "Ticket prices by cinema, show and seat class", (124, 58, 237)),
    ("cab", "Cab & Rides", "Real fares across ride apps before you book", (16, 185, 129)),
    ("loans", "Loans & EMI", "Interest, processing fee and tenure together", (5, 150, 105)),
    ("insurance", "Insurance", "Cover, claim record and premium compared", (13, 148, 136)),
    ("creditcards", "Credit Cards", "Reward rate, annual fee and joining benefits", (2, 132, 199)),
    ("account", "Bank Accounts", "Minimum balance, debit card charges, interest", (99, 102, 241)),
    ("nearby", "Nearby", "Petrol, CNG, EV charging and services around you", (13, 148, 136)),
    ("ev", "EV Charging", "Chargers, power and price per unit nearby", (34, 197, 94)),
]

FONT_CANDIDATES = {
    True: [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
    False: [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ],
}


def font(size: int, bold: bool = False):
    for path in FONT_CANDIDATES[bold]:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def build(vid: str, name: str, line: str, accent) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # brand bar + accent block: the accent identifies the vertical at a glance in a chat list
    d.rectangle([0, 0, W, 10], fill=BRAND)
    d.rectangle([0, 10, 14, H], fill=accent)

    logo = Image.open("public/logo-wordmark.png").convert("RGBA")
    lw = 300
    lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    img.paste(logo, (56, 46), logo)

    d.text((56, 150), name, font=font(76, True), fill=INK)
    # wrap the tagline inside the card width
    words, lines, cur = line.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if d.textlength(trial, font=font(34)) > W - 120:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    y = 252
    for ln in lines[:2]:
        d.text((56, y), ln, font=font(34), fill=MUTED)
        y += 48

    # a truthful footnote: the card never prints a price, so it never prints a stale one
    d.text((56, y + 18), "Prices are checked live when you open the link.", font=font(26), fill=SOFT)

    d.rectangle([0, H - 96, W, H], fill=INK)
    d.text((56, H - 66), "try1second.com", font=font(30, True), fill=(255, 255, 255))
    d.text((W - 470, H - 62), "13 verticals · one search", font=font(24), fill=(148, 163, 184))
    return img


def main() -> None:
    out = os.path.join("public", "og")
    os.makedirs(out, exist_ok=True)
    for vid, name, line, accent in VERTICALS:
        path = os.path.join(out, f"{vid}.png")
        build(vid, name, line, accent).save(path, optimize=True)
        print("wrote", path)


if __name__ == "__main__":
    main()
