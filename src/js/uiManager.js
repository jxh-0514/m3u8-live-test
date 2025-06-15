export class UIManager {
	constructor() {
		// 初始化 DOM 元素引用
		this.checkButton = document.getElementById("checkChannels");
		this.continueButton = document.getElementById("continueCheck");
		this.restartButton = document.getElementById("restartCheck");
		this.progressSpan = document.getElementById("checkProgress");
		this.availableCountSpan = document.getElementById("availableCount");
		this.unavailableCountSpan = document.getElementById("unavailableCount");
		this.channelUrlInput = document.getElementById("channelUrl");
		this.playStreamBtn = document.getElementById("playStream");
		this.streamUrlInput = document.getElementById("streamUrl");
		this.channelSearchInput = document.getElementById("channelSearch");
	}

	updateButtonState(state) {
		switch (state) {
			case "idle":
				this.checkButton.textContent = "检测频道";
				this.checkButton.classList.remove("checking");
				this.checkButton.style.display = "";
				this.continueButton.style.display = "none";
				this.restartButton.style.display = "none";
				break;
			case "checking":
				this.checkButton.textContent = "中断检测";
				this.checkButton.classList.add("checking");
				this.checkButton.style.display = "";
				this.continueButton.style.display = "none";
				this.restartButton.style.display = "none";
				break;
			case "paused":
				this.checkButton.style.display = "none";
				this.continueButton.style.display = "";
				this.restartButton.style.display = "";
				break;
		}
	}

	updateCheckStats(channels) {
		const available = channels.filter((c) => c.isAvailable === true).length;
		const unavailable = channels.filter((c) => c.isAvailable === false).length;
		this.availableCountSpan.textContent = available;
		this.unavailableCountSpan.textContent = unavailable;
	}

	resetStats() {
		this.availableCountSpan.textContent = "0";
		this.unavailableCountSpan.textContent = "0";
	}

	updateChannelList(channels, updateIndex) {
		const channelList = document.getElementById("channelList");

		if (updateIndex === undefined) {
			// 按分组组织频道
			const groups = {};
			channels.forEach((channel, index) => {
				const group = channel.group || "未分组";
				if (!groups[group]) {
					groups[group] = [];
				}
				groups[group].push({ ...channel, index });
			});

			// 清空现有列表
			channelList.innerHTML = "";

			// 渲染分组和频道
			Object.entries(groups).forEach(([groupName, groupChannels]) => {
				channelList.appendChild(this.createGroupElement(groupName, groupChannels));
			});
		} else {
			// 更新单个频道
			const oldElement = channelList.querySelector(`[data-index="${updateIndex}"]`);
			if (oldElement) {
				const newElement = this.createChannelElement(channels[updateIndex], updateIndex);
				oldElement.replaceWith(newElement);
			}
		}
	}

	createGroupElement(groupName, channels) {
		const groupDiv = document.createElement("div");
		groupDiv.className = "channel-group";

		const groupHeader = document.createElement("div");
		groupHeader.className = "group-header";
		groupHeader.innerHTML = `
            <div class="group-title">
                <span class="group-toggle">▼</span>
                <span>${groupName}</span>
                <span class="channel-count">(${channels.length})</span>
            </div>
        `;

		const channelsDiv = document.createElement("div");
		channelsDiv.className = "group-channels";
		channels.forEach((channel) => {
			channelsDiv.appendChild(this.createChannelElement(channel, channel.index));
		});

		groupHeader.addEventListener("click", () => {
			channelsDiv.style.display = channelsDiv.style.display === "none" ? "block" : "none";
			const toggle = groupHeader.querySelector(".group-toggle");
			toggle.textContent = channelsDiv.style.display === "none" ? "▶" : "▼";
		});

		groupDiv.appendChild(groupHeader);
		groupDiv.appendChild(channelsDiv);
		return groupDiv;
	}

	createChannelElement(channel, index) {
		const channelDiv = document.createElement("div");
		let className = "channel-item";
		let status = "";

		// 检测频道类型
		const channelType = this.detectChannelType(channel.url, channel.name);
		const typeLabel = this.getChannelTypeLabel(channelType);
		const showType = channelType !== "live"; // 不显示live类型

		if (channel.isAvailable === true) {
			className += " available";
			status = "✓ 可用";
		} else if (channel.isAvailable === false) {
			className += " unavailable";
			status = "✗ 不可用";
		}

		channelDiv.className = className;
		channelDiv.setAttribute("data-index", index);
		channelDiv.setAttribute("data-name", channel.name.toLowerCase());
		channelDiv.innerHTML = `
            <div class="channel-info">
                <span class="name">${channel.name}</span>
                <div class="channel-meta">
                    ${showType ? `<span class="channel-type ${channelType}">${typeLabel}</span>` : ""}
                    ${status ? `<span class="status">${status}</span>` : ""}
                </div>
            </div>
        `;

		if (channel.isAvailable !== false) {
			channelDiv.onclick = () => {
				document.querySelectorAll(".channel-item").forEach((item) => {
					item.classList.remove("active");
				});
				channelDiv.classList.add("active");
				this.streamUrlInput.value = channel.url;

				// 触发自定义事件
				const event = new CustomEvent("channelSelect", {
					detail: channel,
					bubbles: true, // 确保事件可以冒泡
					cancelable: true, // 允许事件被取消
				});

				// 先触发事件，让应用程序有机会处理频道切换的准备工作
				document.dispatchEvent(event);

				// 使用 requestAnimationFrame 延迟播放操作
				// 这样可以确保 DOM 更新和事件处理都已完成
				requestAnimationFrame(() => {
					// 检查频道是否仍然是激活状态（用户可能已经点击了另一个频道）
					if (channelDiv.classList.contains("active")) {
						this.playStreamBtn.click();
					}
				});
			};
		}

		return channelDiv;
	}

	// 检测频道类型
	detectChannelType(url, name) {
		if (!url) return "unknown";

		const urlLower = url.toLowerCase();
		const nameLower = name.toLowerCase();

		// 检测直播流特征
		const liveIndicators = [".m3u8", "/live/", "live.", "stream", "rtmp://", "rtsp://", "udp://", "rtp://", "hls", "dash"];

		// 检测点播特征
		const vodIndicators = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", "/vod/", "/movie/", "/video/", "movie", "film", "episode"];

		// 检测名称中的直播关键词
		const liveNameKeywords = ["live", "直播", "tv", "电视", "news", "新闻", "sport", "体育", "cctv", "卫视", "频道"];

		// 检测名称中的点播关键词
		const vodNameKeywords = ["movie", "电影", "drama", "电视剧", "series", "episode", "集", "season", "季"];

		// 优先检查URL
		for (const indicator of liveIndicators) {
			if (urlLower.includes(indicator)) {
				return "live";
			}
		}

		for (const indicator of vodIndicators) {
			if (urlLower.includes(indicator)) {
				return "vod";
			}
		}

		// 检查名称
		for (const keyword of liveNameKeywords) {
			if (nameLower.includes(keyword)) {
				return "live";
			}
		}

		for (const keyword of vodNameKeywords) {
			if (nameLower.includes(keyword)) {
				return "vod";
			}
		}

		// 默认判断：如果是m3u8格式，倾向于认为是直播
		if (urlLower.includes(".m3u8")) {
			return "live";
		}

		return "unknown";
	}

	// 获取频道类型标签
	getChannelTypeLabel(type) {
		switch (type) {
			case "live":
				return "LIVE";
			case "vod":
				return "VOD";
			default:
				return "未知";
		}
	}
}
