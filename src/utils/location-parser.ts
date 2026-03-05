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
  getCityFromCoordinates(coords: Coordinates): string {
    const { latitude, longitude } = coords;

    // Taiwan major cities boundaries (approximate)
    // Taipei City: 25.0°N-25.2°N, 121.4°E-121.7°E
    if (latitude >= 25.0 && latitude <= 25.2 && longitude >= 121.4 && longitude <= 121.7) {
      return 'Taipei';
    }

    // New Taipei City: surrounding Taipei
    if (latitude >= 24.6 && latitude <= 25.3 && longitude >= 121.2 && longitude <= 122.0) {
      return 'NewTaipei';
    }

    // Taoyuan: 24.8°N-25.1°N, 121.0°E-121.5°E
    if (latitude >= 24.8 && latitude <= 25.1 && longitude >= 121.0 && longitude <= 121.5) {
      return 'Taoyuan';
    }

    // Taichung: 24.0°N-24.3°N, 120.5°E-121.0°E
    if (latitude >= 24.0 && latitude <= 24.3 && longitude >= 120.5 && longitude <= 121.0) {
      return 'Taichung';
    }

    // Tainan: 22.9°N-23.2°N, 120.1°E-120.5°E
    if (latitude >= 22.9 && latitude <= 23.2 && longitude >= 120.1 && longitude <= 120.5) {
      return 'Tainan';
    }

    // Kaohsiung: 22.5°N-22.8°N, 120.2°E-120.5°E
    if (latitude >= 22.5 && latitude <= 22.8 && longitude >= 120.2 && longitude <= 120.5) {
      return 'Kaohsiung';
    }

    // Hsinchu: 24.7°N-24.9°N, 120.9°E-121.1°E
    if (latitude >= 24.7 && latitude <= 24.9 && longitude >= 120.9 && longitude <= 121.1) {
      return 'Hsinchu';
    }

    // Default to Taipei if can't determine
    return 'Taipei';
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
