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
  parseRouteUrl(url: string): Route {
    try {
      const urlObj = new URL(url);
      
      // Extract origin and destination from URL
      const origin = urlObj.searchParams.get('origin');
      const destination = urlObj.searchParams.get('destination');

      if (!origin || !destination) {
        throw new Error('Route URL must contain origin and destination');
      }

      return {
        origin: this.extractCoordinates(origin)!,
        destination: this.extractCoordinates(destination)!,
      };
    } catch (error) {
      throw new Error(`Invalid route URL: ${error}`);
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
  async geocodeAddress(address: string): Promise<Coordinates> {
    // TODO: Implement with Google Maps API or TDX API
    throw new Error('Geocoding not yet implemented');
  }
}
