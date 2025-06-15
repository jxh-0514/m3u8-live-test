import { player } from "./player.js";
import { channelChecker } from "./channelChecker.js";
import Utils from "./utils.js";
import { notification } from "./notification.js";
import { SourceManager } from "./sourceManager.js";
import { UIManager } from "./uiManager.js";
import { ChannelModal } from "./channelModal.js";

// 设置多个代理 Worker URL，提高成功率
const PROXY_WORKERS = ["https://m3u8-proxy.1942499981.workers.dev", "https://cors-anywhere.herokuapp.com", "https://api.allorigins.win/raw?url="];

class App {
	constructor() {
		this.currentChannels = [];
		this.isChecking = false;
		this.ui = new UIManager();
		this.sourceManager = new SourceManager();
		this.channelModal = new ChannelModal();

		// 设置代理URL列表
		player.setProxyUrls(PROXY_WORKERS);

		// 设置全局模态框引用，供其他模块使用
		window.channelModal = this.channelModal;

		this.initializeEventListeners();

		// 页面加载完成后自动加载频道列表
		document.addEventListener("DOMContentLoaded", () => {
			// 等待SourceManager初始化完成后加载默认频道源
			setTimeout(() => {
				this.loadDefaultSource();
			}, 100);
		});
	}

	initializeEventListeners() {
		// 添加频道源按钮
		const addSourceBtn = document.getElementById("addSourceBtn");
		if (addSourceBtn) {
			addSourceBtn.addEventListener("click", () => {
				this.channelModal.showAddSource();
			});
		}

		// 检测按钮事件
		this.ui.checkButton.addEventListener("click", () => {
			if (this.isChecking) {
				this.stopChannelCheck();
			} else {
				this.startChannelCheck(0);
			}
		});

		// 继续检测按钮事件
		this.ui.continueButton.addEventListener("click", () => {
			const startIndex = channelChecker.getLastCheckedIndex() + 1;
			if (startIndex >= this.currentChannels.length) {
				notification.warning("已完成所有频道检测");
				this.ui.updateButtonState("idle");
				return;
			}
			notification.info(`从第 ${startIndex + 1} 个频道继续检测...`);
			this.startChannelCheck(startIndex);
		});

		// 重新检测按钮事件
		this.ui.restartButton.addEventListener("click", () => {
			channelChecker.stopChecking();
			this.startChannelCheck(0);
		});

		// 播放流按钮事件
		this.ui.playStreamBtn.addEventListener("click", () => {
			const url = this.ui.streamUrlInput.value;
			if (url) {
				player.play(url);
			}
		});

		// 搜索输入框事件
		this.ui.channelSearchInput.addEventListener("input", (e) => {
			this.handleChannelSearch(e.target.value);
		});

		// 监听频道源变更事件
		document.addEventListener("sourceChange", (e) => {
			const { url } = e.detail;
			if (url) {
				this.loadChannelList(url);
			}
		});

		// 监听频道源添加事件
		document.addEventListener("addChannelSource", (e) => {
			// 事件已在 SourceManager 中处理
		});

		// 监听频道源编辑事件
		document.addEventListener("editChannelSource", (e) => {
			// 事件已在 SourceManager 中处理
		});

		// 侧边栏收缩功能
		this.initSidebarToggle();

		// 移动端侧边栏控制
		this.initMobileSidebar();

		// 主题切换功能
		this.initThemeToggle();
	}

	// 初始化侧边栏收缩功能
	initSidebarToggle() {
		const sidebarToggle = document.getElementById("sidebarToggle");
		const sidebar = document.getElementById("sidebar");

		if (sidebarToggle && sidebar) {
			// 恢复保存的状态
			const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
			if (isCollapsed) {
				sidebar.classList.add("collapsed");
			}

			sidebarToggle.addEventListener("click", () => {
				sidebar.classList.toggle("collapsed");
				localStorage.setItem("sidebarCollapsed", sidebar.classList.contains("collapsed"));
			});
		}
	}

	// 初始化移动端侧边栏控制
	initMobileSidebar() {
		const mobileMenuBtn = document.getElementById("mobileMenuBtn");
		const mobileOverlay = document.getElementById("mobileOverlay");
		const sidebar = document.getElementById("sidebar");

		if (mobileMenuBtn && mobileOverlay && sidebar) {
			// 打开侧边栏
			mobileMenuBtn.addEventListener("click", () => {
				sidebar.classList.add("mobile-show");
				mobileOverlay.classList.add("show");
			});

			// 点击遮罩关闭侧边栏
			mobileOverlay.addEventListener("click", () => {
				sidebar.classList.remove("mobile-show");
				mobileOverlay.classList.remove("show");
			});

			// ESC键关闭侧边栏
			document.addEventListener("keydown", (e) => {
				if (e.key === "Escape" && sidebar.classList.contains("mobile-show")) {
					sidebar.classList.remove("mobile-show");
					mobileOverlay.classList.remove("show");
				}
			});
		}
	}

	// 初始化主题切换功能
	initThemeToggle() {
		// 恢复保存的主题状态
		const isDarkMode = localStorage.getItem("darkMode") === "true";
		document.body.classList.toggle("dark-mode", isDarkMode);

		const themeToggle = document.getElementById("toggleTheme");

		if (themeToggle) {
			themeToggle.addEventListener("click", () => {
				document.body.classList.toggle("dark-mode");
				localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
			});
		}
	}

	// 加载默认频道源
	loadDefaultSource() {
		const sources = this.sourceManager.sources;
		const sourceNames = Object.keys(sources);

		if (sourceNames.length > 0) {
			// 选择第一个频道源
			const firstSourceName = sourceNames[0];
			this.sourceManager.selectSource(firstSourceName);
		} else {
			// 如果没有频道源，尝试加载默认URL
			const defaultUrl = this.ui.channelUrlInput.value;
			if (defaultUrl) {
				this.loadChannelList(defaultUrl);
			}
		}
	}

	async loadChannelList(url) {
		try {
			// 如果正在检测，先停止检测
			if (this.isChecking) {
				this.stopChannelCheck();
			}

			notification.info("正在加载频道列表...");
			this.ui.checkButton.disabled = true;

			// 重置UI状态
			this.ui.updateButtonState("idle");
			this.ui.resetStats();
			this.ui.progressSpan.textContent = "";

			const channels = await player.loadChannels(url);
			this.currentChannels = channels;
			this.ui.updateChannelList(channels);
			this.ui.checkButton.disabled = false;
			notification.success(`成功加载 ${channels.length} 个频道`);
		} catch (error) {
			this.ui.checkButton.disabled = true;
			notification.error("加载频道列表失败");
			console.error("加载失败:", error);
		}
	}

	async startChannelCheck(startIndex) {
		if (this.currentChannels.length === 0) {
			notification.warning("请先加载频道列表");
			return;
		}

		if (startIndex === 0) {
			this.resetChannelStatus();
		}

		this.isChecking = true;
		this.ui.updateButtonState("checking");
		this.ui.progressSpan.textContent = Utils.formatProgress(startIndex, this.currentChannels.length);

		try {
			await channelChecker.checkChannels(
				this.currentChannels,
				(checked, total) => {
					if (this.isChecking) {
						this.ui.progressSpan.textContent = Utils.formatProgress(checked, total);
					}
				},
				(result, index) => {
					if (this.isChecking) {
						this.currentChannels[index] = result;
						this.ui.updateChannelList(this.currentChannels, index);
						this.ui.updateCheckStats(this.currentChannels);
					}
				},
				startIndex
			);

			if (this.isChecking) {
				notification.success(Utils.formatResults(this.currentChannels));
				this.ui.updateButtonState("idle");
			}
		} catch (error) {
			if (error.message !== "检测被中断") {
				notification.error("检测过程中发生错误");
				console.error("检测错误:", error);
			}
			this.ui.updateButtonState("paused");
		} finally {
			this.isChecking = false;
		}
	}

	stopChannelCheck() {
		this.isChecking = false;
		channelChecker.stopChecking();
		this.ui.updateButtonState("paused");
		notification.warning("已中断频道检测");
	}

	resetChannelStatus() {
		this.currentChannels = this.currentChannels.map((channel) => ({
			name: channel.name,
			url: channel.url,
			group: channel.group,
		}));

		this.ui.progressSpan.textContent = "";
		this.ui.resetStats();
		channelChecker.lastCheckedIndex = -1;
		this.ui.updateChannelList(this.currentChannels);
	}

	handleChannelSearch(searchText) {
		searchText = searchText.toLowerCase();
		const groups = document.querySelectorAll(".channel-group");

		groups.forEach((group) => {
			let hasVisibleChannels = false;
			const channels = group.querySelectorAll(".channel-item");

			channels.forEach((channel) => {
				const name = channel.getAttribute("data-name");
				const visible = name.includes(searchText);
				channel.style.display = visible ? "block" : "none";
				if (visible) hasVisibleChannels = true;
			});

			group.style.display = hasVisibleChannels ? "block" : "none";
		});
	}
}

// 初始化应用
const app = new App();
