import { Coordinates, Location, Route } from '../models/types';

export class LocationParser {
  // Parse Telegram location message
  parseTelegramLocation(location: { latitude: number; longitude: number }): Coordinates {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  // Parse Google Maps URL
  parseGoogleMapsUrl(url: string): Location {
    try {
      // Handle different Google Maps URL formats
      // Format 1: https://maps.google.com/?q=25.0330,121.5654
      // Format 2: https://www.google.com/maps/place/25.0330,121.5654
      // Format 3: https://maps.app.goo.gl/... (shortened URL)
      
      const urlObj = new URL(url);
      
      // Try to extract from query parameter
      const qParam = urlObj.searchParams.get('q');
      if (qParam) {
        const coords = this.extractCoordinates(qParam);
        if (coords) {
          return { coordinates: coords };
        }
      }

      // Try to extract from path
      const pathMatch = url.match(/@?(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (pathMatch) {
        return {
          coordinates: {
            latitude: parseFloat(pathMatch[1]),
            longitude: parseFloat(pathMatch[2]),
          },
        };
      }

      throw new Error('Could not extract coordinates from URL');
    } catch (error) {
      throw new Error(`Invalid Google Maps URL: ${error}`);
    }
  }

  // Parse Google Maps route URL
  async parseRouteUrl(url: string): Promise<Route> {
    try {
      // Handle shortened URLs (maps.app.goo.gl, goo.gl)
      if (url.includes('goo.gl') || url.includes('maps.app')) {
        url = await this.expandShortUrl(url);
      }
      
      const urlObj = new URL(url);
      
      // Try to extract from query parameters first (old format)
      const originParam = urlObj.searchParams.get('origin');
      const destinationParam = urlObj.searchParams.get('destination');

      if (originParam && destinationParam) {
        return {
          origin: this.extractCoordinates(originParam)!,
          destination: this.extractCoordinates(destinationParam)!,
        };
      }
      
      // Try to extract from path format: /dir/起點/終點/@lat,lon,zoom/...
      // Example: /dir/Address1/Address2/@25.0926845,121.609901,13z/...
      const pathMatch = url.match(/\/dir\/([^/]+)\/([^/]+)\/@?(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (pathMatch) {
        // Extract center coordinates from @lat,lon
        const centerLat = parseFloat(pathMatch[3]);
        const centerLon = parseFloat(pathMatch[4]);
        
        // For now, use center point as both origin and destination
        // This is a limitation - ideally we'd geocode the addresses
        // But for traffic query, we can use the bounding box around the center
        const offset = 0.05; // ~5km offset
        return {
          origin: {
            latitude: centerLat - offset,
            longitude: centerLon - offset,
          },
          destination: {
            latitude: centerLat + offset,
            longitude: centerLon + offset,
          },
        };
      }
      
      // Try to extract coordinates from data parameter or other formats
      const dataMatch = url.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+).*!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
      if (dataMatch) {
        return {
          origin: {
            latitude: parseFloat(dataMatch[2]),
            longitude: parseFloat(dataMatch[1]),
          },
          destination: {
            latitude: parseFloat(dataMatch[4]),
            longitude: parseFloat(dataMatch[3]),
          },
        };
      }

      throw new Error('無法從 URL 中提取路線資訊');
    } catch (error) {
      throw new Error(`Invalid route URL: ${error}`);
    }
  }
  
  // Expand shortened Google Maps URL
  private async expandShortUrl(shortUrl: string): Promise<string> {
    try {
      const response = await fetch(shortUrl, {
        method: 'HEAD',
        redirect: 'follow',
      });
      return response.url;
    } catch (error) {
      console.error('Failed to expand short URL:', error);
      throw new Error('無法展開短網址');
    }
  }

  // Validate if coordinates are in Taiwan
  isInTaiwan(coords: Coordinates): boolean {
    const { latitude, longitude } = coords;
    
    // Taiwan boundaries: 21-26°N, 119-122°E
    return (
      latitude >= 21 &&
      latitude <= 26 &&
      longitude >= 119 &&
      longitude <= 122
    );
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // Distance in meters
  }

  // Determine city from coordinates
  // TDX API city names reference: https://tdx.transportdata.tw/api-service/swagger
  getCityFromCoordinates(coords: Coordinates): string | null {
    const { latitude, longitude } = coords;

    // City boundaries ordered from most specific (small) to broadest (large)
    // to avoid overlap issues

    // Keelung: 25.09°N-25.18°N, 121.69°E-121.80°E
    if (latitude >= 25.09 && latitude <= 25.18 && longitude >= 121.69 && longitude <= 121.80) {
      return 'Keelung';
    }

    // Taipei City: 24.96°N-25.21°N, 121.43°E-121.67°E
    if (latitude >= 24.96 && latitude <= 25.21 && longitude >= 121.43 && longitude <= 121.67) {
      return 'Taipei';
    }

    // Hsinchu City: 24.73°N-24.84°N, 120.89°E-121.05°E
    if (latitude >= 24.73 && latitude <= 24.84 && longitude >= 120.89 && longitude <= 121.05) {
      return 'Hsinchu';
    }

    // Chiayi City: 23.43°N-23.51°N, 120.39°E-120.50°E
    if (latitude >= 23.43 && latitude <= 23.51 && longitude >= 120.39 && longitude <= 120.50) {
      return 'Chiayi';
    }

    // New Taipei City: surrounds Taipei, broader area
    if (latitude >= 24.67 && latitude <= 25.30 && longitude >= 121.28 && longitude <= 122.01) {
      return 'NewTaipei';
    }

    // Taoyuan: 24.73°N-25.12°N, 121.01°E-121.40°E
    if (latitude >= 24.73 && latitude <= 25.12 && longitude >= 121.01 && longitude <= 121.40) {
      return 'Taoyuan';
    }

    // Hsinchu County: 24.53°N-24.85°N, 120.85°E-121.35°E
    if (latitude >= 24.53 && latitude <= 24.85 && longitude >= 120.85 && longitude <= 121.35) {
      return 'HssinchuCounty';
    }

    // Miaoli County: 24.30°N-24.68°N, 120.62°E-121.25°E
    if (latitude >= 24.30 && latitude <= 24.68 && longitude >= 120.62 && longitude <= 121.25) {
      return 'MiaoliCounty';
    }

    // Taichung: 24.03°N-24.47°N, 120.47°E-121.06°E
    if (latitude >= 24.03 && latitude <= 24.47 && longitude >= 120.47 && longitude <= 121.06) {
      return 'Taichung';
    }

    // Changhua County: 23.82°N-24.18°N, 120.25°E-120.68°E
    if (latitude >= 23.82 && latitude <= 24.18 && longitude >= 120.25 && longitude <= 120.68) {
      return 'ChanghuaCounty';
    }

    // Nantou County: 23.63°N-24.11°N, 120.38°E-121.32°E
    if (latitude >= 23.63 && latitude <= 24.11 && longitude >= 120.38 && longitude <= 121.32) {
      return 'NantouCounty';
    }

    // Yunlin County: 23.50°N-23.82°N, 120.15°E-120.73°E
    if (latitude >= 23.50 && latitude <= 23.82 && longitude >= 120.15 && longitude <= 120.73) {
      return 'YunlinCounty';
    }

    // Chiayi County: 23.24°N-23.60°N, 120.30°E-120.77°E
    if (latitude >= 23.24 && latitude <= 23.60 && longitude >= 120.30 && longitude <= 120.77) {
      return 'ChiayiCounty';
    }

    // Tainan: 22.88°N-23.40°N, 120.04°E-120.65°E
    if (latitude >= 22.88 && latitude <= 23.40 && longitude >= 120.04 && longitude <= 120.65) {
      return 'Tainan';
    }

    // Kaohsiung: 22.47°N-23.47°N, 120.15°E-120.86°E
    if (latitude >= 22.47 && latitude <= 23.47 && longitude >= 120.15 && longitude <= 120.86) {
      return 'Kaohsiung';
    }

    // Pingtung County: 21.90°N-22.88°N, 120.36°E-120.93°E
    if (latitude >= 21.90 && latitude <= 22.88 && longitude >= 120.36 && longitude <= 120.93) {
      return 'PingtungCounty';
    }

    // Yilan County: 24.30°N-24.82°N, 121.35°E-121.98°E
    if (latitude >= 24.30 && latitude <= 24.82 && longitude >= 121.35 && longitude <= 121.98) {
      return 'YilanCounty';
    }

    // Hualien County: 23.30°N-24.35°N, 121.10°E-121.75°E
    if (latitude >= 23.30 && latitude <= 24.35 && longitude >= 121.10 && longitude <= 121.75) {
      return 'HualienCounty';
    }

    // Taitung County: 22.30°N-23.45°N, 120.75°E-121.55°E
    if (latitude >= 22.30 && latitude <= 23.45 && longitude >= 120.75 && longitude <= 121.55) {
      return 'TaitungCounty';
    }

    // Penghu County: 23.20°N-23.80°N, 119.30°E-119.72°E
    if (latitude >= 23.20 && latitude <= 23.80 && longitude >= 119.30 && longitude <= 119.72) {
      return 'PenghuCounty';
    }

    // Kinmen County: 24.38°N-24.52°N, 118.20°E-118.45°E
    if (latitude >= 24.38 && latitude <= 24.52 && longitude >= 118.20 && longitude <= 118.45) {
      return 'KinmenCounty';
    }

    // Lienchiang County (Matsu): 25.94°N-26.38°N, 119.88°E-120.51°E
    if (latitude >= 25.94 && latitude <= 26.38 && longitude >= 119.88 && longitude <= 120.51) {
      return 'LienchiangCounty';
    }

    // Not in any known city boundary
    return null;
  }

  // Helper: Extract coordinates from string
  private extractCoordinates(str: string): Coordinates | null {
    const match = str.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) {
      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2]),
      };
    }
    return null;
  }

  // Geocode address to coordinates (placeholder - requires Maps API)
  async geocodeAddress(_address: string): Promise<Coordinates> {
    // TODO: Implement with Google Maps API or TDX API
    throw new Error('Geocoding not yet implemented');
  }
}
