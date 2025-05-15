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
		this.maxRetries = 1; // 自动重连最大次数
		this.retryTimer = null;
		this.proxyUrl = null; // Worker URL，将在初始化时设置
		this.proxyEnabled = true; // 代理开关状态
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
		// 保存当前播放地址
		this.currentUrl = url;

		// 如果是新的播放请求（非重试），重置重试计数
		if (!isRetry) {
			this.retryCount = 0;
			if (this.retryTimer) {
				clearTimeout(this.retryTimer);
				this.retryTimer = null;
			}
		}

		// 销毁现有播放器实例
		if (this.player) {
			this.player.destroy();
			this.player = null;
		}

		const container = document.getElementById("dplayer");
		// 确保容器是空的
		container.innerHTML = "";

		// 获取代理后的URL
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
					// 启用 Web Worker
					enableWorker: true,
					// 启用低延迟模式
					lowLatencyMode: true,
					// 配置重试参数
					manifestLoadingMaxRetry: 2,
					levelLoadingMaxRetry: 2,
					fragLoadingMaxRetry: 2,
				},
			},
		});

		// 监听错误事件
		this.player.on("error", () => {
			this.handlePlayError("播放错误，正在尝试恢复...");
		});

		// 监听播放开始事件
		this.player.on("playing", () => {
			this.retryCount = 0;
			if (this.retryTimer) {
				clearTimeout(this.retryTimer);
				this.retryTimer = null;
			}
			notification.success("直播正在播放中");
		});

		// 监听播放结束事件
		this.player.on("ended", () => {
			this.handlePlayError("直播流已结束");
		});
	}

	/**
	 * 处理播放错误
	 * @param {string} errorMessage - 错误信息
	 */
	handlePlayError(errorMessage = "播放出错") {
		if (this.retryCount < this.maxRetries) {
			this.retryCount++;
			const delay = Math.min(2000 * this.retryCount, 10000); // 递增重试延迟，最大10秒

			notification.warning(`${errorMessage}，${delay / 1000}秒后进行第${this.retryCount}次重试...`);

			this.retryTimer = setTimeout(() => {
				notification.info(`正在进行第${this.retryCount}次重试...`);
				this.initPlayer(this.currentUrl, true);
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
	 * 加载并显示频道列表
	 * @param {string} url - 频道列表地址
	 * @returns {Promise<Array<{name: string, url: string}>>} 频道列表
	 */
	async loadChannels(url) {
		const channelList = document.getElementById("channelList");
		channelList.innerHTML = '<div class="channel-item">加载中...</div>';

		try {
			const channels = await Utils.loadChannelList(url);
			channelList.innerHTML = "";

			channels.forEach((channel) => {
				const channelDiv = document.createElement("div");
				channelDiv.className = "channel-item";
				channelDiv.textContent = channel.name;
				channelDiv.onclick = () => {
					// 移除其他频道的active类
					document.querySelectorAll(".channel-item").forEach((item) => {
						item.classList.remove("active");
					});
					// 添加active类到当前频道
					channelDiv.classList.add("active");
					// 播放当前频道
					this.play(channel.url);
				};
				channelList.appendChild(channelDiv);
			});

			notification.success(`成功加载 ${channels.length} 个频道`);
			return channels; // 返回频道列表
		} catch (error) {
			channelList.innerHTML = '<div class="channel-item">加载失败</div>';
			notification.error("加载频道列表失败，请检查地址是否正确");
			throw error; // 抛出错误以便调用者处理
		}
	}
}

// 创建播放器实例
const player = new Player();

// 导出播放器实例
export { player };
