import { Hono } from "hono";
import { getMimeType } from "hono/utils/mime";
import isFQDN from 'validator/lib/isFQDN';
import { getManifestFromBody, getIconsFromBody, generatePlaceholder } from './utils';
const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/icon/:hostname/:filename?", async (c) => {
	// Grab the hostname from the URL
	let hostname = c.req.param("hostname");
	let filename = c.req.param("filename") || 'favicon.ico';
	let mime: any = getMimeType(filename);
	let cacheKey: any = btoa(`${hostname}-${filename}-v1`)
	let ttl: any = c.env.TTL || 604800;

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
	let iconServers = [
		`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
		`https://icons.duckduckgo.com/ip3/${hostname}.ico`,
		`https://icons.bitwarden.net/${hostname}/icon.png`,
		`https://favicons.nextdns.io/${hostname}@2x.png`,
		`https://favicon.yandex.net/favicon/${hostname}`
	]
	let promises: any = []
	for (let i of iconServers) {
		promises.push(fetch(i, {
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
		}));
	}
	let res: any = await Promise.any(promises);
	if (res.status == 200) {
		let r: any = res.clone()
		await c.env.KV.put(cacheKey, r.body, {
			metadata: { 'Content-Type': r.headers.get('Content-Type')},
			expirationTtl: ttl
		});
		return c.body(res.body, {
			headers: {
				'Content-Type': res.headers.get('Content-Type')
			}
		})
	}

	// Once it's valid, we then fetch it
	let d: any = await fetch(`http://${hostname}`, {
		redirect: "follow",
		cf: {
			cacheTtlByStatus: {
				"200-299": 86400,
				404: 1,
				"500-599": 0
			}
		}
	});
	let url: any = new URL(d.url);
	let reqInfo: any = {
		status: d.status,
		protocol: url.protocol.replaceAll(":", ""),
		hostname: url.hostname,
		url: d.url,
	};
	let body: any = await d.text();

	// Once we have the markup, we'll send it to cheerio
	let icons: any = [];

	// First, we attempt to find a manifest
	try {
		icons = await getManifestFromBody(body)
	}
	catch(e: any) {}

	// Otherwise, time to grab the DOM
	if (icons.length == 0) {
		try {
			icons = await getIconsFromBody(body, reqInfo)
		}
		catch(e: any) {}
	}

	// Did we find any icons? If not, we'll add a default check for /favicon.ico
	if (icons.length == 0) {
		icons = [
			{
				src: new URL("/favicon.ico", reqInfo.url).href,
				sizes: "",
				type: "image/x-icon",
			}
		]
	};

	// Now, we'll check for a filename, and fetch an appropriate icon if one exists
	let image: any = "";
	for (let i of icons) {
		if (i.type == mime) image = i.src
	}

	// But, we guard and deliver the default one if no preference was specified or found
	if (image == "") image = icons[0].src;

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
		// We're going to fallback to a placeholder image, so generate it
		let fallback: any = generatePlaceholder(100, 100, '#31343C', '#EEE', hostname.slice(0,2).toUpperCase())
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