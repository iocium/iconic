export type Service = 'google' | 'duckduckgo' | 'bitwarden' | 'yandex' | 'nextdns' | 'iconHorse';

export interface FaviconResult {
  url: string;
  status: number;
  contentType: string | null;
  content: ArrayBuffer;
}

export class FaviconFetch {
  private hostname: string;

  constructor(hostname: string) {
    if (!hostname) throw new Error('Hostname is required');
    this.hostname = hostname;
  }

  private static serviceUrls: Record<Service, (hostname: string) => string> = {
    google: (hostname) => `https://www.google.com/s2/favicons?domain=${hostname}`,
    duckduckgo: (hostname) => `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
    bitwarden: (hostname) => `https://icons.bitwarden.net/${hostname}/icon.png`,
    yandex: (hostname) => `https://favicon.yandex.net/favicon/${hostname}`,
    nextdns: (hostname) => `https://favicons.nextdns.io/${hostname}@2x.png`,
    iconHorse: (hostname) => `https://icon.horse/icon/${hostname}`
  };

  public async fetchFavicon(service: Service = 'google'): Promise<FaviconResult> {
    const urlFn = FaviconFetch.serviceUrls[service];
    const url = urlFn(this.hostname);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch favicon from ${service}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const result: FaviconResult = {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      content: arrayBuffer
    };

    return result;
  }
}