/**
 * Converts any Google Maps URL (embed URL, full place URL, <iframe src="...">, or short link)
 * into a safe iframe-embeddable Google Maps URL.
 */
export function toSafeMapEmbedUrl(rawInput: string, fallbackAddress?: string): string {
  let raw = (rawInput || "").trim();

  // Extract src="..." if user pasted full <iframe> HTML
  const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    raw = iframeMatch[1].trim();
  }

  if (!raw && fallbackAddress) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(fallbackAddress)}&z=16&output=embed`;
  }

  if (!raw) return "";

  // Already a valid embed URL
  if (raw.includes("/maps/embed") || raw.includes("output=embed")) {
    return raw;
  }

  // Extract @lat,lng from full Google Maps URLs
  const coordMatch = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&z=16&output=embed`;
  }

  // Extract !3dLAT!4dLNG from data params
  const dataCoordMatch = raw.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataCoordMatch) {
    return `https://maps.google.com/maps?q=${dataCoordMatch[1]},${dataCoordMatch[2]}&z=16&output=embed`;
  }

  // Extract /maps/place/NAME/
  const placeMatch = raw.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch && placeMatch[1]) {
    const query = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
  }

  // Fallback for short links (maps.app.goo.gl / goo.gl/maps) that cannot be embedded directly
  if (fallbackAddress && fallbackAddress.trim()) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(fallbackAddress.trim())}&z=16&output=embed`;
  }

  return "";
}

/**
 * Server-side resolver: follows redirects on short links (maps.app.goo.gl)
 * and converts the destination URL to an embeddable Google Maps URL.
 */
export async function resolveGoogleMapsEmbedUrl(
  rawInput: string,
  fallbackAddress?: string
): Promise<string> {
  let raw = (rawInput || "").trim();
  const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    raw = iframeMatch[1].trim();
  }

  if (!raw) {
    return toSafeMapEmbedUrl("", fallbackAddress);
  }

  if (raw.includes("/maps/embed") || raw.includes("output=embed")) {
    return raw;
  }

  // Resolve short links server-side
  if (raw.includes("maps.app.goo.gl") || raw.includes("goo.gl/maps")) {
    try {
      const res = await fetch(raw, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BrewBlissBot/1.0)",
        },
      });
      if (res.url && !res.url.includes("maps.app.goo.gl")) {
        const converted = toSafeMapEmbedUrl(res.url, fallbackAddress);
        if (converted) return converted;
      }
    } catch {
      // Ignore network error and fall through to address fallback
    }
  }

  return toSafeMapEmbedUrl(raw, fallbackAddress);
}
