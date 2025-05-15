import { player } from "./player.js";
import { channelChecker } from "./channelChecker.js";
import Utils from "./utils.js";
import { notification } from "./notification.js";
import { SourceManager } from "./sourceManager.js";
import { UIManager } from "./uiManager.js";

// 设置 Worker URL（部署后需要更新为实际的 Worker URL）
const WORKER_URL = "https://m3u8-proxy.1942499981.workers.dev";

class App {
	constructor() {
		this.currentChannels = [];
		this.isChecking = false;
		this.ui = new UIManager();
		this.sourceManager = new SourceManager();

		player.setProxyUrl(WORKER_URL);
		this.initializeEventListeners();
	}

	initializeEventListeners() {
		// 加载频道按钮事件
		this.ui.loadChannelsBtn.addEventListener("click", () => {
			const url = this.ui.channelUrlInput.value;
			if (!url) {
				notification.warning("请选择或输入频道列表地址");
				return;
			}
			this.loadChannelList(url);
		});

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
	}

	async loadChannelList(url) {
		try {
			notification.info("正在加载频道列表...");
			this.ui.checkButton.disabled = true;
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
