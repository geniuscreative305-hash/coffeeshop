import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "public", "images", "seed");
fs.mkdirSync(dir, { recursive: true });

const products = [
  ["cappuccino.svg", "Signature Cappuccino", "#4A2C18", "#D7B996"],
  ["caramel-macchiato.svg", "Caramel Macchiato", "#6B3E26", "#E6BE8A"],
  ["aren-latte.svg", "Aren Oat Latte", "#5C3A21", "#DFC5A4"],
  ["matcha-latte.svg", "Uji Matcha Latte", "#3B5E3A", "#CFE0C3"],
  ["dark-chocolate.svg", "Belgian Chocolate", "#2E1B12", "#BFA594"],
  ["butter-croissant.svg", "Butter Croissant", "#8B5A2B", "#F4D8A8"],
  ["chocolate-muffin.svg", "Chocolate Muffin", "#3D2314", "#C9A88D"],
  ["chicken-sandwich.svg", "Club Sandwich", "#7A5230", "#EFE0C9"],
  ["tiramisu-slice.svg", "Tiramisu Slice", "#4A2C18", "#EAD9C3"],
  ["breakfast-toast.svg", "Egg Toast", "#8B5A2B", "#F5E6CC"],
];

for (const [file, title, bg, accent] of products) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#23170F"/></linearGradient></defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="400" cy="360" r="180" fill="${accent}" opacity="0.22"/>
  <circle cx="400" cy="360" r="120" fill="${accent}" opacity="0.38"/>
  <circle cx="400" cy="360" r="82" fill="#FAF7F2"/>
  <text x="400" y="645" text-anchor="middle" font-family="Georgia, serif" font-size="36" font-weight="bold" fill="#FAF7F2">${title}</text>
  <text x="400" y="690" text-anchor="middle" font-family="sans-serif" font-size="20" fill="${accent}">BREW &amp; BLISS</text>
</svg>`;
  fs.writeFileSync(path.join(dir, file), svg);
}

const promos = [
  ["promo-morning.svg", "Good Coffee, Good Vibes", "15% OFF • NGOPIPAGI", "#4A2C18", "#8B5A2B"],
  ["promo-weekend.svg", "Weekend Pastry Pairing", "HEMAT Rp 5.000 • HEMAT5K", "#361F10", "#C48A47"],
];

for (const [file, title, sub, bg, accent] of promos) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#23170F"/><stop offset="100%" stop-color="${bg}"/></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#pg)"/>
  <circle cx="980" cy="360" r="240" fill="${accent}" opacity="0.26"/>
  <circle cx="980" cy="360" r="155" fill="#FAF7F2" opacity="0.14"/>
  <text x="90" y="305" font-family="sans-serif" font-size="28" font-weight="bold" fill="#F4D8A8">${sub}</text>
  <text x="90" y="385" font-family="Georgia, serif" font-size="60" font-weight="bold" fill="#FAF7F2">${title}</text>
</svg>`;
  fs.writeFileSync(path.join(dir, file), svg);
}

console.log("Generated", products.length + promos.length, "seed SVGs in public/images/seed");

