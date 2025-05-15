export default {
	async fetch(request, env) {
		// 处理 CORS 预检请求
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
					"Access-Control-Allow-Headers": "*",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		const url = new URL(request.url);
		const targetUrl = url.searchParams.get("url");

		if (!targetUrl) {
			return new Response("Missing url parameter", {
				status: 400,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Content-Type": "text/plain",
				},
			});
		}

		try {
			const targetUrlObj = new URL(targetUrl);

			// 生成认证参数
			const timestamp = Math.floor(Date.now() / 1000);
			const userToken = `CMCC_IPTV_${timestamp}`;
			const deviceId = `MOBILE_H5_${Math.random().toString(36).substr(2, 9)}`;

			// 构建新的URL，添加认证参数
			const authUrl = new URL(targetUrl);
			authUrl.searchParams.append("playSessionToken", userToken);
			authUrl.searchParams.append("deviceId", deviceId);
			authUrl.searchParams.append("channel", "88888888");
			authUrl.searchParams.append("time", timestamp.toString());
			authUrl.searchParams.append("auth_type", "mobile_h5");

			// 构建请求头
			const headers = new Headers({
				"User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
				Accept: "*/*",
				"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
				"Accept-Encoding": "identity",
				Origin: "http://ottrrs.hl.chinamobile.com",
				Referer: "http://ottrrs.hl.chinamobile.com/",
				Host: targetUrlObj.host,
				Connection: "keep-alive",
				Range: request.headers.get("Range") || "bytes=0-",
				// IPTV 特定头部
				"X-Requested-With": "XMLHttpRequest",
				"X-Client-IP": "27.224.147.198",
				"X-Real-IP": "27.224.147.198",
				"X-Forwarded-For": "27.224.147.198",
				"True-Client-IP": "27.224.147.198",
				"Client-IP": "27.224.147.198",
				Authorization: "Basic " + btoa(userToken + ":" + deviceId),
				"User-Region": "CN-HLJ",
				"Client-Version": "3.9.6",
				"Device-ID": deviceId,
				Platform: "android_h5",
				"Channel-ID": "88888888",
				"Service-Type": "live",
				"Content-Type": "application/x-www-form-urlencoded",
				"Access-Token": userToken,
				"Cache-Control": "no-cache",
				Pragma: "no-cache",
			});

			// 发送请求
			const response = await fetch(authUrl.toString(), {
				method: request.method,
				headers: headers,
				redirect: "follow",
				cf: {
					// Cloudflare 特定配置
					cacheEverything: false,
					cacheTtl: 0,
					mirage: false,
					scrapeShield: false,
					apps: false,
					// 使用中国的 DNS
					resolveOverride: "223.5.5.5",
					// 尝试使用 HTTP/1.1
					httpVersion: "1",
					clientTcpRtt: 100,
					// 禁用 Cloudflare 的自动优化
					polish: "off",
					minify: {
						javascript: false,
						css: false,
						html: false,
					},
				},
			});

			// 检查响应状态
			if (!response.ok && response.status !== 206) {
				const responseText = await response.text();
				console.error({
					status: response.status,
					statusText: response.statusText,
					headers: Object.fromEntries(response.headers),
					body: responseText,
					url: authUrl.toString(),
				});
				throw new Error(`上游服务器返回错误: ${response.status} ${response.statusText}\n${responseText}`);
			}

			// 创建新的响应头
			const responseHeaders = new Headers({
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
				"Access-Control-Allow-Headers": "*",
				"Access-Control-Expose-Headers": "*",
				"Access-Control-Max-Age": "86400",
				"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
				Pragma: "no-cache",
				Expires: "0",
			});

			// 复制原始响应的重要头部
			for (const [key, value] of response.headers.entries()) {
				if (!key.toLowerCase().startsWith("access-control-")) {
					responseHeaders.set(key, value);
				}
			}

			// 返回代理的响应
			return new Response(response.body, {
				status: response.status,
				headers: responseHeaders,
			});
		} catch (error) {
			console.error({
				error: error.message,
				stack: error.stack,
				url: targetUrl,
				headers: Object.fromEntries(request.headers),
			});

			// 返回详细的错误信息
			return new Response(
				JSON.stringify(
					{
						error: "代理请求失败",
						message: error.message,
						url: targetUrl,
						timestamp: new Date().toISOString(),
					},
					null,
					2
				),
				{
					status: 500,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
						"Cache-Control": "no-store",
					},
				}
			);
		}
	},
};
