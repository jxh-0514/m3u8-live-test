export class UIManager {
	constructor() {
		// 初始化 DOM 元素引用
		this.checkButton = document.getElementById("checkChannels");
		this.continueButton = document.getElementById("continueCheck");
		this.restartButton = document.getElementById("restartCheck");
		this.progressSpan = document.getElementById("checkProgress");
		this.availableCountSpan = document.getElementById("availableCount");
		this.unavailableCountSpan = document.getElementById("unavailableCount");
		this.loadChannelsBtn = document.getElementById("loadChannels");
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
                ${status ? `<span class="status">${status}</span>` : ""}
            </div>
        `;

		if (channel.isAvailable !== false) {
			channelDiv.onclick = () => {
				document.querySelectorAll(".channel-item").forEach((item) => {
					item.classList.remove("active");
				});
				channelDiv.classList.add("active");
				this.streamUrlInput.value = channel.url;
				// 自动触发播放按钮点击
				this.playStreamBtn.click();
				// 触发自定义事件
				const event = new CustomEvent("channelSelect", { detail: channel });
				document.dispatchEvent(event);
			};
		}

		return channelDiv;
	}
}
