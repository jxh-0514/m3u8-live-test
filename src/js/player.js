import { notification } from "./notification.js";
import Utils from "./utils.js";

/**
 * 播放器核心功能模块
 */
class Player {
	constructor() {
		this.player = null;
		this.currentUrl = "";
		this.retryCount = 0;
		this.maxRetries = 2; // 增加最大重试次数
		this.retryTimer = null;
		this.proxyUrls = []; // 代理URL列表，将在初始化时设置
		this.currentProxyIndex = 0; // 当前使用的代理索引
		this.proxyEnabled = false; // 代理开关状态
		this.hlsInstance = null; // 添加 HLS 实例引用
		this.isInitialPlay = true; // 添加标记，用于区分初始播放和用户暂停
		this.isDestroying = false; // 添加销毁标志
		this.initEventListeners();
	}

	/**
	 * 设置代理URL列表
	 * @param {Array} urls - 代理URL数组
	 */
	setProxyUrls(urls) {
		this.proxyUrls = urls || [];
		this.currentProxyIndex = 0;
	}

	/**
	 * 获取当前代理URL
	 * @returns {string} 当前代理URL
	 */
	getCurrentProxyUrl() {
		if (this.proxyUrls.length === 0) return null;
		return this.proxyUrls[this.currentProxyIndex];
	}

	/**
	 * 切换到下一个代理
	 * @returns {boolean} 是否还有可用代理
	 */
	switchToNextProxy() {
		if (this.proxyUrls.length === 0) return false;
		this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyUrls.length;
		return this.currentProxyIndex !== 0; // 如果回到第一个，说明已经尝试了所有代理
	}

	/**
	 * 获取代理后的URL
	 * @param {string} url - 原始URL
	 * @returns {string} 代理后的URL
	 */
	getProxiedUrl(url) {
		// 添加输入 URL 检查
		if (!url) {
			console.error("[getProxiedUrl] 输入的 URL 为空");
			return "";
		}

		const currentProxyUrl = this.getCurrentProxyUrl();

		// 记录代理状态
		console.log("[getProxiedUrl] 代理状态:", {
			currentProxyUrl,
			proxyEnabled: this.proxyEnabled,
			inputUrl: url,
			proxyIndex: this.currentProxyIndex,
		});

		if (!currentProxyUrl || !this.proxyEnabled) {
			return url; // 如果没有设置代理或代理被禁用，直接返回原始URL
		}

		// 根据不同的代理服务构造URL
		let proxiedUrl;
		if (currentProxyUrl.includes("allorigins.win")) {
			proxiedUrl = `${currentProxyUrl}${encodeURIComponent(url)}`;
		} else {
			proxiedUrl = `${currentProxyUrl}?url=${encodeURIComponent(url)}`;
		}

		console.log("[getProxiedUrl] 生成的代理 URL:", proxiedUrl);
		return proxiedUrl;
	}

	/**
	 * 设置代理状态
	 * @param {boolean} enabled - 是否启用代理
	 */
	setProxyEnabled(enabled) {
		this.proxyEnabled = enabled;
		// 如果当前正在播放，则重新加载使用新的代理设置
		if (this.currentUrl) {
			this.play(this.currentUrl);
		}
		notification.info(enabled ? "已启用代理" : "已禁用代理");
	}

	/**
	 * 初始化事件监听器
	 */
	initEventListeners() {
		// 监听窗口大小变化，更新播放器大小
		window.addEventListener("resize", () => {
			if (this.player) {
				this.player.resize();
			}
		});

		// 监听代理开关
		const proxyToggle = document.getElementById("proxyToggle");
		if (proxyToggle) {
			// 从本地存储加载代理状态
			this.proxyEnabled = Utils.storage.get("proxyEnabled", true);
			proxyToggle.checked = this.proxyEnabled;

			proxyToggle.addEventListener("change", (e) => {
				this.setProxyEnabled(e.target.checked);
				// 保存代理状态到本地存储
				Utils.storage.save("proxyEnabled", e.target.checked);
			});
		}
	}

	/**
	 * 停止流的加载但保持当前画面
	 */
	stopStream() {
		if (this.hlsInstance) {
			// 只停止加载新的分片，不分离媒体元素
			this.hlsInstance.stopLoad();
		}
	}

	/**
	 * 恢复流并获取最新画面
	 */
	resumeLatestStream() {
		if (!this.player || !this.currentUrl) {
			return;
		}

		if (this.hlsInstance) {
			try {
				// 停止当前加载
				this.hlsInstance.stopLoad();

				// 重新开始加载，这会从最新的 segment 开始
				setTimeout(() => {
					// 重新检查实例是否存在
					if (!this.hlsInstance || !this.player) {
						console.log("[resumeLatestStream] 播放器已被销毁，重新初始化");
						this.initPlayer(this.currentUrl, true);
						return;
					}

					// 重新开始加载
					this.hlsInstance.startLoad();

					// 开始播放
					if (this.player.video) {
						const playPromise = this.player.video.play();
						if (playPromise !== undefined) {
							playPromise.catch((err) => {
								console.error("[resumeLatestStream] 播放失败:", err);
								// 如果简单的恢复失败，则重新初始化播放器
								this.initPlayer(this.currentUrl, true);
							});
						}
					} else {
						console.error("[resumeLatestStream] 视频元素不存在");
						this.initPlayer(this.currentUrl, true);
					}
				}, 100); // 给一个短暂的延迟，确保 stopLoad 完成

				notification.info("正在获取最新画面...");
			} catch (err) {
				console.error("[resumeLatestStream] 恢复流失败:", err);
				// 如果出现错误，重新初始化播放器
				this.initPlayer(this.currentUrl, true);
			}
		} else {
			// 如果没有 HLS 实例，重新初始化播放器
			this.initPlayer(this.currentUrl, true);
		}
	}

	/**
	 * 初始化播放器
	 * @param {string} url - 视频流地址
	 * @param {boolean} isRetry - 是否是重试请求
	 */
	initPlayer(url, isRetry = false) {
		if (this.isDestroying) {
			console.log("[initPlayer] 播放器正在销毁中，取消初始化");
			return;
		}

		// 验证输入 URL
		if (!url) {
			console.error("[initPlayer] 输入的 URL 为空");
			notification.error("播放失败：无效的URL地址");
			return;
		}

		console.log("[initPlayer] 开始初始化播放器:", {
			url,
			isRetry,
			isDestroying: this.isDestroying,
			currentUrl: this.currentUrl,
		});

		this.isInitialPlay = true;
		this.currentUrl = url;

		if (!isRetry) {
			this.retryCount = 0;
			if (this.retryTimer) {
				clearTimeout(this.retryTimer);
				this.retryTimer = null;
			}
		}

		const container = document.getElementById("dplayer");
		if (!container) {
			console.error("[initPlayer] 找不到播放器容器元素");
			return;
		}
		container.innerHTML = "";

		const proxiedUrl = this.getProxiedUrl(url);
		if (!proxiedUrl) {
			console.error("[initPlayer] 获取代理 URL 失败");
			notification.error("播放失败：无法获取有效的播放地址");
			return;
		}

		console.log("[initPlayer] 创建播放器实例:", {
			originalUrl: url,
			proxiedUrl: proxiedUrl,
		});

		// 创建新的播放器实例
		try {
			this.player = new DPlayer({
				container: container,
				live: true,
				autoplay: true,
				theme: "#f27441",
				video: {
					url: proxiedUrl,
					type: "hls",
				},
				pluginOptions: {
					hls: {
						enableWorker: true,
						lowLatencyMode: true,
						manifestLoadingMaxRetry: 3,
						levelLoadingMaxRetry: 3,
						fragLoadingMaxRetry: 3,
						liveSyncDurationCount: 3,
						liveMaxLatencyDurationCount: 5,
						enableStashBuffer: false,
						autoStartLoad: true,
						// 添加更多 HLS 配置以优化直播体验
						liveBackBufferLength: 0, // 不保留回放缓冲
						maxBufferLength: 5, // 减少最大缓冲长度
						maxMaxBufferLength: 5, // 限制最大缓冲区大小
						startPosition: -1, // 从最新片段开始播放
					},
				},
			});
		} catch (err) {
			// 错误处理代码保持不变
			console.error("[initPlayer] 播放失败:", err);
			notification.error("播放失败：无法获取有效的播放地址");
			return;
		}

		// 保存 HLS 实例的引用
		if (this.player && this.player.plugins && this.player.plugins.hls) {
			this.hlsInstance = this.player.plugins.hls;
		}

		// 监听事件
		this.player.on("error", (e) => {
			// 获取当前的代理 URL，而不是使用闭包中的值
			const currentProxiedUrl = this.getProxiedUrl(this.currentUrl);
			console.error("[Player Error] 详细信息:", {
				event: e,
				videoElement: e.target,
				currentUrl: this.currentUrl,
				proxiedUrl: currentProxiedUrl,
				isDestroying: this.isDestroying,
				proxyEnabled: this.proxyEnabled,
				proxyUrl: this.proxyUrl,
			});

			if (!this.isDestroying) {
				this.handlePlayError("播放错误，正在尝试恢复...");
			}
		});

		this.player.on("loadstart", () => {
			if (this.isInitialPlay && !this.isDestroying) {
				this.player.play();
			}
		});

		this.player.on("playing", () => {
			if (!this.isDestroying) {
				this.isInitialPlay = false;
				this.retryCount = 0;
				if (this.retryTimer) {
					clearTimeout(this.retryTimer);
					this.retryTimer = null;
				}
				notification.success("直播正在播放中");
			}
		});

		this.player.on("ended", () => {
			if (!this.isDestroying) {
				this.handlePlayError("直播流已结束");
			}
		});

		// 修改暂停事件处理
		this.player.on("pause", () => {
			if (!this.isInitialPlay && !this.isDestroying) {
				// 暂停时只停止加载新的分片，保持当前画面
				if (this.hlsInstance) {
					this.hlsInstance.stopLoad();
				}
				notification.info("已暂停直播");
			}
		});

		// 修改播放事件处理
		this.player.on("play", () => {
			if (!this.isInitialPlay && !this.isDestroying) {
				this.resumeLatestStream();
			}
		});
	}

	/**
	 * 播放指定URL
	 * @param {string} url - 视频流地址
	 */
	async play(url, options = {}) {
		if (!Utils.isValidUrl(url)) {
			notification.error("无效的URL地址");
			return;
		}

		if (this.isSwitching) return;
		this.isSwitching = true;
		if (this.currentUrl === url && this.player) {
			this.isSwitching = false;
			return;
		}
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
		this.retryCount = 0;
		await this.destroyPlayer();
		this.initPlayer(url, false, options);
		this.isSwitching = false;
	}

	async destroyPlayer() {
		this.isDestroying = true;
		this.isInitialPlay = true;
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
		if (this.hlsInstance) {
			this.hlsInstance.stopLoad();
			this.hlsInstance.destroy();
			this.hlsInstance = null;
		}
		if (this.player) {
			// 解绑所有事件
			this.player.off && this.player.off();
			this.player.pause();
			this.player.destroy();
			this.player = null;
		}
		this.isDestroying = false;
	}

	/**
	 * 处理播放错误
	 * @param {string} errorMessage - 错误信息
	 */
	handlePlayError(errorMessage = "播放出错", options = {}) {
		if (this.isDestroying) return;
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}

		const maxRetries = options.maxRetries || this.maxRetries;
		const retryDelay = options.retryDelay || 5000;

		// 如果启用了代理且有多个代理可用，先尝试切换代理
		if (this.proxyEnabled && this.proxyUrls.length > 1 && this.retryCount < maxRetries) {
			const hasNextProxy = this.switchToNextProxy();
			if (hasNextProxy || this.retryCount === 0) {
				this.retryCount++;
				const currentProxyUrl = this.getCurrentProxyUrl();
				notification.info(`切换到代理 ${this.currentProxyIndex + 1}/${this.proxyUrls.length}，正在重试...`);

				const retryUrl = this.currentUrl;
				this.retryTimer = setTimeout(() => {
					if (!this.isDestroying && this.currentUrl === retryUrl) {
						this.destroyPlayer().then(() => {
							this.initPlayer(retryUrl, true, options);
						});
					}
				}, 1000);
				return;
			}
		}

		// 常规重试逻辑
		if (this.retryCount < maxRetries) {
			this.retryCount++;
			const delay = Math.min(1000 * this.retryCount, retryDelay);
			notification.warning(`${errorMessage}，${delay / 1000}秒后进行第${this.retryCount}次重试...`);
			const retryUrl = this.currentUrl;
			this.retryTimer = setTimeout(() => {
				if (!this.isDestroying && this.currentUrl === retryUrl) {
					notification.info(`正在进行第${this.retryCount}次重试...`);
					this.destroyPlayer().then(() => {
						this.initPlayer(retryUrl, true, options);
					});
				}
			}, delay);
		} else {
			// 重置代理索引，为下次播放做准备
			this.currentProxyIndex = 0;
			notification.error(`${errorMessage}\n已达到最大重试次数(${maxRetries})。请检查：\n` + "1. 网络连接是否正常\n" + "2. 直播源是否有效\n" + "3. 是否存在跨域限制\n" + "4. 尝试切换其他频道源");
		}
	}

	/**
	 * 解析M3U格式的频道列表
	 * @param {string} content - M3U文件内容
	 * @returns {Array<{name: string, url: string, group: string}>} 解析后的频道列表
	 */
	parseM3U(content) {
		const channels = [];
		const lines = content.split("\n").map((line) => line.trim());

		let currentChannel = null;

		for (let line of lines) {
			if (line.startsWith("#EXTM3U")) {
				continue;
			}

			if (line.startsWith("#EXTINF:")) {
				// 解析频道信息
				currentChannel = {};

				// 解析group-title
				const groupMatch = line.match(/group-title="([^"]+)"/);
				if (groupMatch) {
					currentChannel.group = groupMatch[1];
				}

				// 解析频道名称（在最后一个逗号后面的内容）
				const nameMatch = line.match(/,([^,]+)$/);
				if (nameMatch) {
					currentChannel.name = nameMatch[1].trim();
				}
			} else if (line && currentChannel && !line.startsWith("#")) {
				// 这是频道URL
				currentChannel.url = line;
				channels.push(currentChannel);
				currentChannel = null;
			}
		}

		return channels;
	}

	/**
	 * 加载频道列表
	 * @param {string} url - 频道列表地址
	 * @returns {Promise<Array>} 频道列表
	 */
	async loadChannels(url) {
		try {
			const response = await fetch(this.getProxiedUrl(url));
			if (!response.ok) {
				throw new Error("加载频道列表失败");
			}
			const content = await response.text();

			// 检查是否是M3U格式
			if (content.trim().startsWith("#EXTM3U")) {
				return this.parseM3U(content);
			} else {
				// 保留原有的解析逻辑，假设是简单的文本格式
				return content
					.split("\n")
					.map((line) => line.trim())
					.filter((line) => line && !line.startsWith("#"))
					.map((line) => {
						const [name, url] = line.split(",").map((s) => s.trim());
						return { name: name || url, url };
					});
			}
		} catch (error) {
			notification.error("加载频道列表失败");
			throw error;
		}
	}
}

// 创建播放器实例
const player = new Player();

// 导出播放器实例
export { player };
