import { notification } from "./notification.js";

export class SourceManager {
	constructor() {
		this.storageKey = "channelSources";
		this.defaultSources = {
			国际频道: "https://raw.githubusercontent.com/YueChan/Live/refs/heads/main/Global.m3u",
			IPTV频道: "https://raw.githubusercontent.com/YueChan/Live/refs/heads/main/IPTV.m3u",
		};
		this.sources = this.loadSources();
		this.currentSource = null;
		this.initializeUI();
		this.initializeEventListeners();
	}

	loadSources() {
		const savedSources = localStorage.getItem(this.storageKey);
		if (savedSources) {
			const parsed = JSON.parse(savedSources);
			return { ...this.defaultSources, ...parsed };
		}
		return { ...this.defaultSources };
	}

	initializeUI() {
		this.updateSourceList();
		// 设置默认选中第一个频道源
		const firstSource = Object.keys(this.sources)[0];
		if (firstSource) {
			this.selectSource(firstSource);
		}
	}

	initializeEventListeners() {
		// 监听频道源相关事件
		document.addEventListener("addChannelSource", (e) => {
			this.addSource(e.detail.name, e.detail.url);
		});

		document.addEventListener("editChannelSource", (e) => {
			this.editSource(e.detail.originalName, e.detail.name, e.detail.url);
		});
	}

	updateSourceList() {
		const sourceList = document.getElementById("sourceList");
		if (!sourceList) return;

		sourceList.innerHTML = "";

		Object.entries(this.sources).forEach(([name, url]) => {
			const sourceItem = this.createSourceItem(name, url);
			sourceList.appendChild(sourceItem);
		});
	}

	createSourceItem(name, url) {
		const item = document.createElement("div");
		item.className = "source-item";
		item.dataset.name = name;

		item.innerHTML = `
			<div class="source-info">
				<div class="source-name">${name}</div>
				<div class="source-url">${url}</div>
			</div>
			<div class="source-actions">
				<button class="action-btn edit" data-action="edit" title="编辑">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
					</svg>
				</button>
				<button class="action-btn delete" data-action="delete" title="删除">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="3,6 5,6 21,6"></polyline>
						<path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
					</svg>
				</button>
			</div>
		`;

		// 点击选中频道源
		item.querySelector(".source-info").addEventListener("click", () => {
			this.selectSource(name);
		});

		// 编辑按钮
		item.querySelector('[data-action="edit"]').addEventListener("click", (e) => {
			e.stopPropagation();
			this.editSourceModal(name, url);
		});

		// 删除按钮
		item.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
			e.stopPropagation();
			this.confirmDeleteSource(name);
		});

		return item;
	}

	selectSource(name) {
		// 更新UI选中状态
		document.querySelectorAll(".source-item").forEach((item) => {
			item.classList.remove("active");
		});

		const selectedItem = document.querySelector(`[data-name="${name}"]`);
		if (selectedItem) {
			selectedItem.classList.add("active");
		}

		// 更新当前源
		this.currentSource = name;
		const url = this.sources[name];

		// 触发源变更事件，自动加载频道
		const event = new CustomEvent("sourceChange", {
			detail: { url, name },
		});
		document.dispatchEvent(event);
	}

	addSource(name, url) {
		if (!name || !url) return false;
		if (this.sources[name]) {
			notification.warning("该名称已存在");
			return false;
		}
		this.sources[name] = url;
		this.saveSources();
		this.updateSourceList();
		this.selectSource(name);
		return true;
	}

	editSource(originalName, newName, newUrl) {
		if (!originalName || !newName || !newUrl) return false;

		// 如果名称改变了，检查新名称是否已存在
		if (originalName !== newName && this.sources[newName]) {
			notification.warning("该名称已存在");
			return false;
		}

		// 删除旧的源
		delete this.sources[originalName];

		// 添加新的源
		this.sources[newName] = newUrl;

		this.saveSources();
		this.updateSourceList();
		this.selectSource(newName);
		return true;
	}

	editSourceModal(name, url) {
		// 获取模态框实例并显示编辑模式
		const modal = window.channelModal;
		if (modal) {
			modal.showEditSource({ name, url });
		}
	}

	confirmDeleteSource(name) {
		if (confirm(`确定要删除频道源 "${name}" 吗？`)) {
			this.removeSource(name);
		}
	}

	saveSources() {
		localStorage.setItem(this.storageKey, JSON.stringify(this.sources));
	}

	removeSource(name) {
		if (name && this.sources[name]) {
			delete this.sources[name];
			this.saveSources();
			this.updateSourceList();

			// 如果删除的是当前选中的源，选择第一个可用的源
			if (this.currentSource === name) {
				const firstSource = Object.keys(this.sources)[0];
				if (firstSource) {
					this.selectSource(firstSource);
				}
			}

			notification.success(`频道源 "${name}" 已删除`);
			return true;
		}
		return false;
	}
}
