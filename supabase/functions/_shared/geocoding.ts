// Shared geocoding & POI search utility.
// Primary provider: Google Maps (preview/search API) for high compatibility and accuracy in Taiwan.
// Secondary provider: Nominatim (OpenStreetMap) fallback.

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

/**
 * Extract Google Maps preview fetch URL from an HTML document.
 * Google Maps place/search landing pages contain preload/action links like:
 * <link href="/maps/preview/place?..." as="fetch">
 * <link href="/search?tbm=map..." as="fetch">
 */
export function extractGooglePreviewUrl(html: string): string | null {
  const match = html.match(/href="(\/(?:maps\/preview\/place|search\?tbm=map)[^"]+)"/);
  if (match) {
    return 'https://www.google.com' + match[1].replace(/&amp;/g, '&');
  }
  const actionMatch = html.match(/action="(\/(?:maps\/preview\/place|search\?tbm=map)[^"]+)"/);
  if (actionMatch) {
    return 'https://www.google.com' + actionMatch[1].replace(/&amp;/g, '&');
  }
  return null;
}

/**
 * Parse coordinates and optional display name from Google preview/search response text or HTML.
 */
export function parseGooglePreviewText(
  text: string
): { latitude: number; longitude: number; displayName?: string } | null {
  let lat: number | null = null;
  let lon: number | null = null;
  let displayName: string | undefined = undefined;

  // 1. Zoom and coordinates: [[zoom, lon, lat] or [[zoom, lat, lon]
  const zoomCoordMatch = text.match(/\[\[\d+(?:\.\d+)?,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
  if (zoomCoordMatch) {
    const v1 = parseFloat(zoomCoordMatch[1]);
    const v2 = parseFloat(zoomCoordMatch[2]);
    // In Taiwan, Lng is ~119~122, Lat is ~21~26
    if (Math.abs(v1) > 90 && Math.abs(v2) <= 90) {
      lon = v1;
      lat = v2;
    } else if (Math.abs(v2) > 90 && Math.abs(v1) <= 90) {
      lat = v1;
      lon = v2;
    } else {
      // Default Google Maps preview array order is [zoom, lon, lat]
      lon = v1;
      lat = v2;
    }
  }

  // 2. [null,null,lat,lon]
  if (lat === null || lon === null) {
    const nullMatch = text.match(/\[null,null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/);
    if (nullMatch) {
      const v1 = parseFloat(nullMatch[1]);
      const v2 = parseFloat(nullMatch[2]);
      if (Math.abs(v1) <= 90 && Math.abs(v2) > 90) {
        lat = v1;
        lon = v2;
      } else if (Math.abs(v2) <= 90 && Math.abs(v1) > 90) {
        lat = v2;
        lon = v1;
      } else {
        lat = v1;
        lon = v2;
      }
    }
  }

  // 3. Protobuf pattern: !3d<lat>!4d<lon>
  if (lat === null || lon === null) {
    const altMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (altMatch) {
      lat = parseFloat(altMatch[1]);
      lon = parseFloat(altMatch[2]);
    }
  }

  // 4. Extract display name or address if available
  const nameMatch = text.match(/^\)\]\}'\s*\n\[\["([^"]+)"/) || text.match(/\["([^"]+?[市縣][^"]+?)"\]/);
  if (nameMatch) {
    displayName = nameMatch[1];
  }

  if (lat !== null && lon !== null) {
    return { latitude: lat, longitude: lon, displayName };
  }
  return null;
}

/**
 * Fetch Google Maps preview endpoint and parse coordinates.
 */
export async function fetchGooglePreviewData(
  previewUrl: string
): Promise<{ latitude: number; longitude: number; displayName?: string } | null> {
  try {
    const response = await fetch(previewUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
    });
    if (!response.ok) return null;
    const text = await response.text();
    return parseGooglePreviewText(text);
  } catch (err) {
    console.error('Error fetching Google preview data:', err);
    return null;
  }
}

/**
 * Search POI or address.
 * Uses Google Maps search first (works in cloud/datacenter environments),
 * then falls back to Nominatim OSM.
 */
export async function searchPoi(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // 1. Google Maps search
  try {
    const googleSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(trimmed)}`;
    const response = await fetch(googleSearchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (response.ok) {
      const html = await response.text();
      const previewUrl = extractGooglePreviewUrl(html);
      if (previewUrl) {
        const previewResult = await fetchGooglePreviewData(previewUrl);
        if (previewResult) {
          return {
            latitude: previewResult.latitude,
            longitude: previewResult.longitude,
            displayName: previewResult.displayName || trimmed,
          };
        }
      }

      // Check coordinates embedded directly in HTML
      const htmlResult = parseGooglePreviewText(html);
      if (htmlResult) {
        return {
          latitude: htmlResult.latitude,
          longitude: htmlResult.longitude,
          displayName: htmlResult.displayName || trimmed,
        };
      }
    }
  } catch (error) {
    console.error('Google POI search failed:', error);
  }

  // 2. Nominatim fallback
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      trimmed
    )}&format=json&limit=1&countrycodes=tw&accept-language=zh-TW`;
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'TrafficBot/1.0 (https://github.com/CokeFever/TrafficBot; contact:bot@ixo.app)',
      },
    });

    if (response.ok) {
      const results = await response.json();
      if (results && results.length > 0) {
        return {
          latitude: parseFloat(results[0].lat),
          longitude: parseFloat(results[0].lon),
          displayName: results[0].display_name || trimmed,
        };
      }
    }
  } catch (error) {
    console.error('Nominatim fallback failed:', error);
  }

  return null;
}
