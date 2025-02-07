import * as cheerio from "cheerio";
import { getMimeType } from "hono/utils/mime";

async function getManifestFromBody(html: any) {
    // Instantiate cheerio
    let $: any = cheerio.load(html);
    // Define our selector
    let selectors: any = [
        "link[rel='manifest']"
    ]
    // Now, we tell cheerio to go find it
    let manifests: any = $(selectors.join()).first().attr('href');
    let icons: any = []
    // Did we find anything?
    if (!manifests) return icons;
    // Otherwise, we need to grab the manifest
    try {
      let manifestFetch: any = await fetch(manifests, {
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
      if (manifestFetch.status == 200) manifestFetch = await manifestFetch.json();
      
      if (manifestFetch.icons.length > 0) {
        for (let i of manifestFetch.icons) {
          icons.push({
            src: new URL(i.src, manifests).href,
            sizes: i.sizes,
            type: i.type,
          });
        }
      }

      return icons
    }
    catch(e: any) {
      return icons
    }
}

async function getIconsFromBody(html: any, request: any) {
  // Instantiate cheerio
  let $: any = cheerio.load(html);
  // Define our selectors
  let selectors: any = [
		"link[rel='icon' i][href]",
		"link[rel='shortcut icon' i][href]",
		"link[rel='apple-touch-icon' i][href]",
		"link[rel='apple-touch-icon-precomposed' i][href]",
		"link[rel='apple-touch-startup-image' i][href]",
		"link[rel='mask-icon' i][href]",
		"link[rel='fluid-icon' i][href]",
		"meta[name='msapplication-TileImage' i][content]",
		"meta[name='twitter:image' i][content]",
		"meta[property='og:image' i][content]",
	];
  // Now, we tell cheerio to go find it
  let icons: any = []
  $(selectors.join()).each(function(i: any, el: any) {
    let {
      href = "",
      sizes = "",
      type = "",
      content = "",
      rel = "",
      src = "",
    } = el.attribs;

    // Set the correct src attribute
    src = content;
    if (el.name == "link") src = href;
    if (src && src !== "#") {
      // If we haven't figured out a type, we'll do some real ugly work
      let u: any = new URL(new URL(src, request.url).href).pathname;
      type = getMimeType(u);

      icons.push({
        src: new URL(src, request.url).href,
        sizes,
        type,
      });
    }
  });
  return icons
}

function generatePlaceholder (width = 100, height = 100, color = '#666', background = '#ccc', text) {
    const displayText = text || `${width}x${height}`;
    const svgContent = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${background}" />
      <text x="50%" y="50%" dominant-baseline="middle" font-family="-apple-system, Inter, sans-serif" text-anchor="middle" fill="${color}" font-size="20">
        ${displayText}
      </text>
    </svg>
  `;
  return svgContent
};

export { getManifestFromBody, getIconsFromBody, generatePlaceholder }