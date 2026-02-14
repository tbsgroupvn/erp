import { Injectable, Logger } from '@nestjs/common';

/**
 * Interface representing a tracking event from an external provider.
 */
export interface ITrackingEvent {
  timestamp: Date;
  location: string;
  status: string;
  description: string;
}

/**
 * Tracking provider service (stub for external integration).
 *
 * This service provides an abstraction layer for fetching tracking data
 * from Chinese carrier APIs (kuaidi100, 17Track). The actual API
 * integration will be implemented when credentials are available.
 */
@Injectable()
export class TrackingProviderService {
  private readonly logger = new Logger(TrackingProviderService.name);

  /**
   * Fetches tracking events from Kuaidi100 API.
   *
   * Kuaidi100 (快递100) is one of the most popular logistics tracking
   * aggregators in China, supporting 1000+ carriers.
   *
   * @param trackingNumber - The carrier tracking number
   * @param carrier - Carrier code (e.g., 'shunfeng', 'yuantong', 'zhongtong')
   * @returns Array of tracking events from the carrier
   */
  async fetchFromKuaidi100(
    trackingNumber: string,
    carrier: string,
  ): Promise<ITrackingEvent[]> {
    this.logger.log(
      `[STUB] Fetching from Kuaidi100: ${trackingNumber} (carrier: ${carrier})`,
    );

    // TODO: Implement actual Kuaidi100 API integration
    // API endpoint: https://poll.kuaidi100.com/poll/query.do
    // Requires: customer key, API key
    // Params: { com: carrier, num: trackingNumber }
    //
    // Example response mapping:
    // response.data[].forEach(item => ({
    //   timestamp: new Date(item.ftime),
    //   location: item.areaName || item.location,
    //   status: this.mapKuaidi100Status(item.status),
    //   description: item.context,
    // }))

    return [];
  }

  /**
   * Fetches tracking events from 17Track API.
   *
   * 17Track is a global package tracking platform supporting
   * carriers from 220+ countries.
   *
   * @param trackingNumber - The carrier tracking number
   * @returns Array of tracking events from the carrier
   */
  async fetch17Track(trackingNumber: string): Promise<ITrackingEvent[]> {
    this.logger.log(
      `[STUB] Fetching from 17Track: ${trackingNumber}`,
    );

    // TODO: Implement actual 17Track API integration
    // API endpoint: https://api.17track.net/track/v2/gettrackinfo
    // Requires: API key in header (17token)
    // Body: [{ number: trackingNumber }]
    //
    // Example response mapping:
    // response.data.accepted[0].track.z.forEach(item => ({
    //   timestamp: new Date(item.a),
    //   location: item.c || item.d,
    //   status: this.map17TrackStatus(item.z),
    //   description: item.z,
    // }))

    return [];
  }

  /**
   * Attempts to fetch tracking from all available providers.
   * Falls back between providers if one fails.
   *
   * @param trackingNumber - The carrier tracking number
   * @param carrier - Optional carrier code for Kuaidi100
   * @returns Array of tracking events from the first successful provider
   */
  async fetchFromAnyProvider(
    trackingNumber: string,
    carrier?: string,
  ): Promise<{ provider: string; events: ITrackingEvent[] }> {
    // Try Kuaidi100 first if carrier is specified
    if (carrier) {
      try {
        const events = await this.fetchFromKuaidi100(trackingNumber, carrier);
        if (events.length > 0) {
          return { provider: 'kuaidi100', events };
        }
      } catch (error) {
        this.logger.warn(
          `Kuaidi100 fetch failed for ${trackingNumber}: ${error.message}`,
        );
      }
    }

    // Fall back to 17Track
    try {
      const events = await this.fetch17Track(trackingNumber);
      if (events.length > 0) {
        return { provider: '17track', events };
      }
    } catch (error) {
      this.logger.warn(
        `17Track fetch failed for ${trackingNumber}: ${error.message}`,
      );
    }

    return { provider: 'none', events: [] };
  }
}
