import * as cheerio from "cheerio";

async function getManifest(html: any) {
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

function PlaceHolder (width = 100, height = 100, color = '#666', background = '#ccc', text) {
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

export { getManifest, PlaceHolder }