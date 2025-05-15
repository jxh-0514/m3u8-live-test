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
		this.maxRetries = 3; // 增加最大重试次数
		this.retryTimer = null;
		this.proxyUrl = null; // Worker URL，将在初始化时设置
		this.proxyEnabled = true; // 代理开关状态
		this.hlsInstance = null; // 添加 HLS 实例引用
		this.isInitialPlay = true; // 添加标记，用于区分初始播放和用户暂停
		this.isDestroying = false; // 添加销毁标志
		this.initTheme();
		this.initEventListeners();
	}

	/**
	 * 设置代理URL
	 * @param {string} url - Worker URL
	 */
	setProxyUrl(url) {
		this.proxyUrl = url;
	}

	/**
	 * 获取代理后的URL
	 * @param {string} url - 原始URL
	 * @returns {string} 代理后的URL
	 */
	getProxiedUrl(url) {
		if (!this.proxyUrl || !this.proxyEnabled) {
			return url; // 如果没有设置代理或代理被禁用，直接返回原始URL
		}
		return `${this.proxyUrl}?url=${encodeURIComponent(url)}`;
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
	 * 初始化主题
	 */
	initTheme() {
		const isDarkMode = Utils.storage.get("darkMode", true);
		document.body.classList.toggle("dark-mode", isDarkMode);

		document.getElementById("toggleTheme").addEventListener("click", () => {
			document.body.classList.toggle("dark-mode");
			Utils.storage.save("darkMode", document.body.classList.contains("dark-mode"));
		});
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
	 * 初始化播放器
	 * @param {string} url - 视频流地址
	 * @param {boolean} isRetry - 是否是重试请求
	 */
	initPlayer(url, isRetry = false) {
		if (this.isDestroying) {
			return;
		}

		this.isInitialPlay = true;
		this.currentUrl = url;

		if (!isRetry) {
			this.retryCount = 0;
			if (this.retryTimer) {
				clearTimeout(this.retryTimer);
				this.retryTimer = null;
			}
		}

		this.destroyPlayer();

		if (this.isDestroying) {
			return;
		}

		const container = document.getElementById("dplayer");
		container.innerHTML = "";

		const proxiedUrl = this.getProxiedUrl(url);

		// 创建新的播放器实例
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
					// 设置较小的直播缓冲区，以减少延迟
					liveSyncDurationCount: 3,
					liveMaxLatencyDurationCount: 5,
					// 添加更多 HLS 配置
					enableStashBuffer: false, // 禁用缓存以减少延迟
					autoStartLoad: true,
				},
			},
		});

		// 保存 HLS 实例的引用
		if (this.player && this.player.plugins && this.player.plugins.hls) {
			this.hlsInstance = this.player.plugins.hls;
		}

		// 监听事件
		this.player.on("error", (e) => {
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
		if (this.hlsInstance) {
			// 重新初始化播放器以获取最新画面
			this.initPlayer(this.currentUrl, true);
			notification.info("正在获取最新画面...");
		}
	}

	/**
	 * 销毁播放器实例
	 */
	destroyPlayer() {
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
	handlePlayError(errorMessage = "播放出错") {
		if (this.isDestroying) {
			return;
		}

		if (this.retryCount < this.maxRetries) {
			this.retryCount++;
			const delay = Math.min(1000 * this.retryCount, 5000);

			notification.warning(`${errorMessage}，${delay / 1000}秒后进行第${this.retryCount}次重试...`);

			this.retryTimer = setTimeout(() => {
				if (!this.isDestroying) {
					notification.info(`正在进行第${this.retryCount}次重试...`);
					this.initPlayer(this.currentUrl, true);
				}
			}, delay);
		} else {
			notification.error(`${errorMessage}\n已达到最大重试次数(${this.maxRetries})。请检查：\n` + "1. 网络连接是否正常\n" + "2. 直播源是否有效\n" + "3. 是否存在跨域限制");
		}
	}

	/**
	 * 播放指定URL
	 * @param {string} url - 视频流地址
	 */
	play(url) {
		if (!Utils.isValidUrl(url)) {
			notification.error("无效的URL地址");
			return;
		}

		notification.info("正在连接直播源...");
		this.initPlayer(url);
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
