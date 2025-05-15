import { notification } from "./notification.js";

export class SourceManager {
	constructor() {
		this.storageKey = "channelSources";
		this.defaultSources = {
			国际频道: "https://raw.githubusercontent.com/YueChan/Live/refs/heads/main/Global.m3u",
			IPTV频道: "https://raw.githubusercontent.com/YueChan/Live/refs/heads/main/IPTV.m3u",
		};
		this.sources = this.loadSources();
		this.initializeUI();
		this.addContextMenu();
	}

	loadSources() {
		const savedSources = localStorage.getItem(this.storageKey);
		if (savedSources) {
			const parsed = JSON.parse(savedSources);
			return { ...this.defaultSources, ...parsed };
		}
		return { ...this.defaultSources };
	}

	updateSourceSelect() {
		const select = document.getElementById("channelSource");
		const urlInput = document.getElementById("channelUrl");

		select.innerHTML = "";
		Object.entries(this.sources).forEach(([name, url]) => {
			const option = document.createElement("option");
			option.value = url;
			option.textContent = name;
			select.appendChild(option);
		});

		if (select.options.length > 0) {
			urlInput.value = select.value;
		}
	}

	initializeUI() {
		const select = document.getElementById("channelSource");
		const urlInput = document.getElementById("channelUrl");
		const addButton = document.getElementById("addSource");
		const loadButton = document.getElementById("loadChannels");

		this.updateSourceSelect();

		select.addEventListener("change", () => {
			urlInput.value = select.value;
			// 自动触发加载按钮点击
			loadButton.click();
			// 触发自定义事件
			const event = new CustomEvent("sourceChange", {
				detail: { url: select.value, name: select.options[select.selectedIndex].text },
			});
			document.dispatchEvent(event);
		});

		addButton.addEventListener("click", () => {
			const url = urlInput.value.trim();
			if (!url) {
				notification.warning("请输入频道列表地址");
				return;
			}

			const name = prompt("请输入频道源名称：");
			if (name) {
				this.addSource(name.trim(), url);
			}
		});
	}

	addSource(name, url) {
		if (!name || !url) return false;
		if (this.sources[name]) {
			notification.warning("该名称已存在");
			return false;
		}
		this.sources[name] = url;
		this.saveSources();
		this.updateSourceSelect();
		notification.success("添加成功");
		return true;
	}

	saveSources() {
		localStorage.setItem(this.storageKey, JSON.stringify(this.sources));
	}

	removeSource(name) {
		if (name && this.sources[name]) {
			delete this.sources[name];
			this.saveSources();
			this.updateSourceSelect();
			return true;
		}
		return false;
	}

	addContextMenu() {
		const select = document.getElementById("channelSource");
		const menu = document.createElement("div");
		menu.className = "source-context-menu";
		menu.innerHTML = `
            <div class="menu-item" data-action="delete">删除此频道源</div>
            <div class="menu-item" data-action="export">导出所有频道源</div>
            <div class="menu-item" data-action="import">导入频道源</div>
            <div class="menu-item" data-action="moveup">上移</div>
            <div class="menu-item" data-action="movedown">下移</div>
        `;
		document.body.appendChild(menu);

		select.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			menu.style.display = "block";
			menu.style.left = e.clientX + "px";
			menu.style.top = e.clientY + "px";
		});

		document.addEventListener("click", () => {
			menu.style.display = "none";
		});

		menu.addEventListener("click", (e) => {
			const action = e.target.dataset.action;
			const selectedIndex = select.selectedIndex;
			const selectedName = select.options[selectedIndex].text;

			switch (action) {
				case "delete":
					if (confirm(`是否删除"${selectedName}"？`)) {
						this.removeSource(selectedName);
					}
					break;
				case "export":
					this.exportSources();
					break;
				case "import":
					this.importSources();
					break;
				case "moveup":
					if (selectedIndex > 0) {
						this.moveSource(selectedIndex, selectedIndex - 1);
					}
					break;
				case "movedown":
					if (selectedIndex < select.options.length - 1) {
						this.moveSource(selectedIndex, selectedIndex + 1);
					}
					break;
			}
		});
	}

	exportSources() {
		const data = JSON.stringify(this.sources, null, 2);
		const blob = new Blob([data], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "channel_sources.json";
		a.click();
		URL.revokeObjectURL(url);
	}

	importSources() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";

		input.onchange = (e) => {
			const file = e.target.files[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (e) => {
					try {
						const imported = JSON.parse(e.target.result);
						if (typeof imported === "object") {
							this.sources = { ...this.sources, ...imported };
							this.saveSources();
							this.updateSourceSelect();
							notification.success("导入成功");
						}
					} catch (err) {
						notification.error("导入失败：无效的文件格式");
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	}

	moveSource(fromIndex, toIndex) {
		const select = document.getElementById("channelSource");
		const options = Array.from(select.options);
		const movedOption = options[fromIndex];

		const newSources = {};
		options.forEach((opt, index) => {
			if (index === toIndex) {
				newSources[movedOption.text] = this.sources[movedOption.text];
			}
			if (index !== fromIndex) {
				newSources[opt.text] = this.sources[opt.text];
			}
		});

		this.sources = newSources;
		this.saveSources();
		this.updateSourceSelect();
		select.selectedIndex = toIndex;
	}
}
