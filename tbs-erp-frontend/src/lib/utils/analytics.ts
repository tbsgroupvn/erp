/**
 * Analytics tracking utilities
 * Supports Google Analytics 4 (gtag.js)
 */

declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

/**
 * Track a custom event
 * @param eventName - Name of the event (e.g., 'button_click', 'form_submit')
 * @param params - Additional event parameters
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      ...params,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics Event]', eventName, params);
    }
  }
}

/**
 * Track page view
 * @param url - Page URL
 * @param title - Page title
 */
export function trackPageView(url: string, title?: string) {
  trackEvent('page_view', {
    page_location: url,
    page_title: title || document.title,
  });
}

/**
 * Track button click
 * @param buttonName - Name or ID of the button
 * @param location - Where the button is located (e.g., 'header', 'footer')
 */
export function trackButtonClick(buttonName: string, location?: string) {
  trackEvent('button_click', {
    button_name: buttonName,
    location,
  });
}

/**
 * Track form submission
 * @param formName - Name of the form
 * @param success - Whether submission was successful
 */
export function trackFormSubmit(formName: string, success: boolean = true) {
  trackEvent('form_submit', {
    form_name: formName,
    success,
  });
}

/**
 * Track search query
 * @param query - Search query string
 * @param resultsCount - Number of results returned
 */
export function trackSearch(query: string, resultsCount?: number) {
  trackEvent('search', {
    search_term: query,
    results_count: resultsCount,
  });
}

/**
 * Track file download
 * @param fileName - Name of the downloaded file
 * @param fileType - Type of file (e.g., 'pdf', 'xlsx')
 */
export function trackDownload(fileName: string, fileType?: string) {
  trackEvent('file_download', {
    file_name: fileName,
    file_type: fileType,
  });
}

/**
 * Track outbound link click
 * @param url - Destination URL
 * @param linkText - Text of the link
 */
export function trackOutboundLink(url: string, linkText?: string) {
  trackEvent('click', {
    event_category: 'outbound',
    event_label: url,
    link_text: linkText,
  });
}

/**
 * Track error
 * @param errorMessage - Error message
 * @param errorType - Type of error (e.g., 'validation', 'network')
 * @param fatal - Whether the error is fatal
 */
export function trackError(
  errorMessage: string,
  errorType?: string,
  fatal: boolean = false
) {
  trackEvent('exception', {
    description: errorMessage,
    error_type: errorType,
    fatal,
  });
}

/**
 * Track user engagement
 * @param engagementType - Type of engagement (e.g., 'scroll', 'video_play')
 * @param value - Engagement value (e.g., scroll percentage, video time)
 */
export function trackEngagement(
  engagementType: string,
  value?: number | string
) {
  trackEvent('engagement', {
    engagement_type: engagementType,
    value,
  });
}

/**
 * Track conversion
 * @param conversionType - Type of conversion (e.g., 'contact', 'quote_request')
 * @param value - Conversion value (optional)
 */
export function trackConversion(conversionType: string, value?: number) {
  trackEvent('conversion', {
    conversion_type: conversionType,
    value,
    currency: 'VND',
  });
}

/**
 * Set user properties
 * @param properties - User properties to set
 */
export function setUserProperties(properties: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', properties);
  }
}

/**
 * Track timing
 * @param category - Timing category (e.g., 'load_time', 'api_response')
 * @param variable - Timing variable
 * @param value - Time in milliseconds
 */
export function trackTiming(
  category: string,
  variable: string,
  value: number
) {
  trackEvent('timing_complete', {
    name: variable,
    value,
    event_category: category,
  });
}
