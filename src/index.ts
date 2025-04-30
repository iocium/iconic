import { Hono } from "hono";
import { getMimeType } from "hono/utils/mime";
import isFQDN from 'validator/lib/isFQDN';
import { getManifestFromBody, getIconsFromBody, generatePlaceholder } from './utils';
import { FaviconFetch, Service } from './faviconFetch';
import { FaviconExtractor } from "./faviconExtractor";
const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/icon/:hostname/:filename?", async (c) => {
	// Grab the hostname from the URL
	let hostname = c.req.param("hostname");
	let filename = c.req.param("filename") || 'favicon.ico';
	let mime: any = getMimeType(filename);
	let cacheKey: any = btoa(`${hostname}-${filename}-v1`)
	let ttl: any = c.env.TTL || 604800;
	let fallback: any = generatePlaceholder(100, 100, '#31343C', '#EEE', hostname.slice(0,2).toUpperCase())

	// Next, we validate it
	if (!isFQDN(hostname)) return c.text(`Not Found`, 404);

	// Now, we look for a icon that matches their hostname
	let { cache, metadata }: any = await c.env.KV.getWithMetadata(cacheKey)
	if (cache) {
		// We found something cached
		return c.body(cache, {
			headers: {
				'Content-Type': metadata['Content-Type']
			}
		})
	}

	// First, we're going to check some icon servers, see what they have:
	let enabledServices = [
		'google',
		'duckduckgo',
		'bitwarden',
		'nextdns',
		'yandex'
	]
	let iconFetcher = new FaviconFetch(hostname)
	let promises: any = []
	for (let i of enabledServices) {
		let service = i as Service;
		promises.push(iconFetcher.fetchFavicon(service));
	}
	let { status, content, contentType }: any = await Promise.any(promises);

	// If the icon servers have one, we'll use that
	if (status == 200) {
		await c.env.KV.put(cacheKey, content, {
			metadata: { 'Content-Type': contentType},
			expirationTtl: ttl
		});
		return c.body(content, {
			headers: {
				'Content-Type': contentType
			}
		})
	}

	// If the icon servers don't have anything though, we're going to do it ourselves
	let extractor: any = new FaviconExtractor();
	let iconExtract: any = await extractor.fetchAndExtract(`http://${hostname}`)
	let icons: any = [];
	if (iconExtract.length > 0) {
		icons = extractor.addMimeTypes(iconExtract);
	}

	// Did we find any icons? If not, we'll fallback
	if (icons.length == 0) {
		// We didn't
		await c.env.KV.put(cacheKey, fallback, {
			metadata: { 'Content-Type': 'image/svg+xml'},
			expirationTtl: ttl
		});
		return c.body(fallback, {
			headers: {
				'Content-Type': 'image/svg+xml'
			}
		})
	};

	// Now, we'll check for a filename, and fetch an appropriate icon if one exists
	let image: any = "";
	for (let i of icons) {
		if (i.type == mime) image = i.url
	}

	// But, we guard and deliver the default one if no preference was specified or found
	if (image == "") image = icons[0].url;

	// Now, we go get it
	let i: any = await fetch(image, {
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

	if (i.status !== 200) {
		// Cache it appropriately
		await c.env.KV.put(cacheKey, fallback, {
			metadata: { 'Content-Type': 'image/svg+xml'},
			expirationTtl: ttl
		});
		// And return to viewer
		return c.body(fallback, {
			headers: {
				'Content-Type': 'image/svg+xml'
			}
		})
	}

	// Next, we save it
	let resp: any = i.clone();
	await c.env.KV.put(cacheKey, i.body, {
		metadata: { 'Content-Type': i.headers.get('Content-Type')},
		expirationTtl: ttl
	});

	// And return it
	return c.body(resp.body, {
		headers: {
			'Content-Type': resp.headers.get('Content-Type')
		}
	})
});

export default app;