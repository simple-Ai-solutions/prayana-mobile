// locationDetectionService.ts - Auto-detect user's country based on IP
// Uses ipinfo.io (free tier: 50k requests/month)

interface LocationResult {
  country: string;       // ISO country code (e.g., "IN", "US", "GB")
  countryName: string;   // Will be mapped to full name by the store
  region: string | null;
  city: string | null;
  ip: string | null;
  timezone: string | null;
  fallback?: boolean;
}

class LocationDetectionService {
  private detectionAttempted = false;
  private detectionResult: LocationResult | null = null;

  /**
   * Detect user's country using IP geolocation
   * Uses ipinfo.io (free tier: 50k requests/month)
   */
  async detectUserCountry(): Promise<LocationResult> {
    // Don't detect again if already attempted in this session
    if (this.detectionAttempted && this.detectionResult) {
      return this.detectionResult;
    }

    this.detectionAttempted = true;

    try {
      console.log('Auto-detecting user location...');

      const response = await fetch('https://ipinfo.io/json?token=eb4a93751dfb98', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Location detection failed: ${response.status}`);
      }

      const data = await response.json();

      console.log('Location detected:', {
        country: data.country,
        region: data.region,
        city: data.city,
      });

      this.detectionResult = {
        country: data.country,
        countryName: data.country, // Will be mapped to full name by the store
        region: data.region,
        city: data.city,
        ip: data.ip,
        timezone: data.timezone,
      };

      return this.detectionResult;
    } catch (error) {
      console.error('Location detection error:', error);

      // Fallback to default (India)
      this.detectionResult = {
        country: 'IN',
        countryName: 'India',
        region: null,
        city: null,
        ip: null,
        timezone: null,
        fallback: true,
      };

      return this.detectionResult;
    }
  }

  /**
   * Reset detection state (useful for testing or forcing re-detection)
   */
  reset(): void {
    this.detectionAttempted = false;
    this.detectionResult = null;
  }
}

// Export singleton instance
export const locationDetectionService = new LocationDetectionService();
export default locationDetectionService;
