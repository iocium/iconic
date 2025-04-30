export type IconEntry = {
  type: string;
  size: string;
  url: string;
  mimeType?: string;
};

export class FaviconExtractor {
  private icons: string[] = [];
  private manifestUrl: string | null = null;

  async fetchAndExtract(url: string): Promise<string[]> {
    this.icons = [];
    this.manifestUrl = null;

    const res = await fetch(url, {
        redirect: "follow",
		headers: {
			"User-Agent": "iconium/crawler 1.0",
		},
		cf: {
			cacheTtlByStatus: {
				"200-299": 86400,
				404: 1,
				"500-599": 0
			}
		}
	});
    if (!res.ok) throw new Error(`Failed to fetch URL: ${url}`);

    const rewriter = new HTMLRewriter()
      .on("link", {
        element: this.linkHandler.bind(this),
      })
      .on("meta", {
        element: this.metaHandler.bind(this),
      });

    await rewriter.transform(res).text();

    if (this.manifestUrl) {
      await this.extractIconsFromManifest(this.manifestUrl, url);
    }

    return this.normalizeIcons(url);
  }

  groupIcons(iconUrls: string[]): {
    standardIcons: IconEntry[];
    appleTouchIcons: IconEntry[];
    androidIcons: IconEntry[];
  } {
    const groups = {
      standardIcons: [] as IconEntry[],
      appleTouchIcons: [] as IconEntry[],
      androidIcons: [] as IconEntry[],
    };

    for (const url of iconUrls) {
      const lower = url.toLowerCase();
      const match = url.match(/(\d+x\d+)/);
      const size = match ? match[1] : "unknown";
      const entry: IconEntry = { type: "", size, url };

      if (lower.includes("apple-touch-icon")) {
        entry.type = "apple-touch-icon";
        groups.appleTouchIcons.push(entry);
      } else if (lower.includes("android-chrome")) {
        entry.type = "android-chrome";
        groups.androidIcons.push(entry);
      } else {
        entry.type = "icon";
        groups.standardIcons.push(entry);
      }
    }

    return groups;
  }

  getLargestIcons(grouped: {
    standardIcons: IconEntry[];
    appleTouchIcons: IconEntry[];
    androidIcons: IconEntry[];
  }): IconEntry[] {
    const pickLargest = (icons: IconEntry[]): IconEntry | undefined => {
      return icons
        .map((icon) => ({
          ...icon,
          pixels: this.getPixelCount(icon.size),
        }))
        .sort((a, b) => b.pixels - a.pixels)[0];
    };

    return [
      pickLargest(grouped.standardIcons),
      pickLargest(grouped.appleTouchIcons),
      pickLargest(grouped.androidIcons),
    ].filter(Boolean) as IconEntry[];
  }

  addMimeTypes(icons: string[] | IconEntry[]): IconEntry[] {
    return icons.map((icon) => {
      const url = typeof icon === "string" ? icon : icon.url;
      const ext = url.split(".").pop()?.toLowerCase() || "";
      let mimeType = "image/png";

      if (ext === "ico") mimeType = "image/x-icon";
      else if (ext === "svg") mimeType = "image/svg+xml";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "webp") mimeType = "image/webp";

      return typeof icon === "string"
        ? { type: "", size: "unknown", url, mimeType }
        : { ...icon, mimeType };
    });
  }

  getLargestIconsByMimeType(icons: string[] | IconEntry[]): IconEntry[] {
    const enriched = this.addMimeTypes(icons);

    const groups = new Map<string, IconEntry[]>();

    for (const icon of enriched) {
      const list = groups.get(icon.mimeType!) ?? [];
      list.push(icon);
      groups.set(icon.mimeType!, list);
    }

    const result: IconEntry[] = [];

    for (const [mime, entries] of groups.entries()) {
      const largest = entries
        .map((icon) => ({
          ...icon,
          pixels: this.getPixelCount(icon.size),
        }))
        .sort((a, b) => b.pixels - a.pixels)[0];

      if (largest) result.push(largest);
    }

    return result;
  }

  private getPixelCount(size: string): number {
    const [w, h] = size.split("x").map(Number);
    return isNaN(w) || isNaN(h) ? 0 : w * h;
  }

  private linkHandler(element: Element): void {
    const rel = element.getAttribute("rel")?.toLowerCase() ?? "";
    const href = element.getAttribute("href");

    if (!href) return;

    if (
      rel.includes("icon") ||
      rel.includes("apple-touch-icon") ||
      rel.includes("shortcut icon")
    ) {
      this.icons.push(href);
    } else if (rel === "manifest") {
      this.manifestUrl = href;
    }
  }

  private metaHandler(element: Element): void {
    const name = element.getAttribute("name")?.toLowerCase() ?? "";
    const content = element.getAttribute("content");

    if (name === "msapplication-tileimage" && content) {
      this.icons.push(content);
    }
  }

  private async extractIconsFromManifest(
    manifestHref: string,
    baseUrl: string
  ): Promise<void> {
    try {
      const base = new URL(baseUrl);
      const manifestUrl = new URL(manifestHref, base).href;

      const res = await fetch(manifestUrl);
      if (!res.ok) return;

      const manifest = await res.json();
      if (Array.isArray(manifest.icons)) {
        for (const icon of manifest.icons) {
          if (typeof icon.src === "string") {
            this.icons.push(icon.src);
          }
        }
      }
    } catch (err) {
      console.warn("Manifest parsing failed:", (err as Error).message);
    }
  }

  private normalizeIcons(baseUrl: string): string[] {
    const base = new URL(baseUrl);
    const uniqueIcons = new Set<string>();

    for (const icon of this.icons) {
      try {
        uniqueIcons.add(new URL(icon, base).href);
      } catch {
        continue;
      }
    }

    return [...uniqueIcons];
  }
}
