import { notification } from "./notification.js";

/**
 * 频道管理模态对话框类
 * 支持添加频道源、添加单个频道、编辑频道源等功能
 */
export class ChannelModal {
	constructor() {
		this.modal = document.getElementById("addChannelModal");
		this.form = document.getElementById("addChannelForm");
		this.modalTitle = this.modal.querySelector(".modal-header h3");
		this.nameInput = document.getElementById("channelName");
		this.addressInput = document.getElementById("channelAddress");

		this.nameError = document.getElementById("nameError");
		this.addressError = document.getElementById("addressError");
		this.confirmBtn = document.getElementById("confirmAdd");
		this.cancelBtn = document.getElementById("cancelAdd");
		this.closeBtn = document.getElementById("closeModal");

		// 模态框状态
		this.currentMode = "addSource"; // 'addSource', 'editSource'
		this.editingData = null;

		this.initializeEventListeners();
	}

	initializeEventListeners() {
		// 事件监听器现在在 app.js 中处理

		// 关闭模态框
		this.closeBtn.addEventListener("click", () => this.hide());
		this.cancelBtn.addEventListener("click", () => this.hide());

		// 点击背景关闭
		this.modal.addEventListener("click", (e) => {
			if (e.target === this.modal) {
				this.hide();
			}
		});

		// ESC键关闭
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this.modal.classList.contains("show")) {
				this.hide();
			}
		});

		// 表单提交
		this.form.addEventListener("submit", (e) => {
			e.preventDefault();
			this.handleSubmit();
		});

		// 实时验证
		this.nameInput.addEventListener("input", () => this.validateName());
		this.addressInput.addEventListener("input", () => this.validateAddress());
		this.addressInput.addEventListener("blur", () => this.validateAddress());
	}

	// 显示添加频道源模态框
	showAddSource() {
		this.currentMode = "addSource";
		this.editingData = null;
		this.setupModalForMode();
		this.show();
	}

	// 显示编辑频道源模态框
	showEditSource(sourceData) {
		this.currentMode = "editSource";
		this.editingData = sourceData;
		this.setupModalForMode();
		this.show();
	}

	// 根据模式设置模态框
	setupModalForMode() {
		switch (this.currentMode) {
			case "addSource":
				this.modalTitle.textContent = "添加频道源";
				this.nameInput.placeholder = "请输入频道源名称";
				this.addressInput.placeholder = "请输入M3U8频道列表地址";
				this.confirmBtn.textContent = "添加频道源";
				break;
			case "editSource":
				this.modalTitle.textContent = "编辑频道源";
				this.nameInput.placeholder = "请输入频道源名称";
				this.addressInput.placeholder = "请输入M3U8频道列表地址";
				this.confirmBtn.textContent = "保存修改";
				if (this.editingData) {
					this.nameInput.value = this.editingData.name;
					this.addressInput.value = this.editingData.url;
				}
				break;
		}
	}

	show() {
		this.modal.style.display = "flex";
		// 使用 requestAnimationFrame 确保 display 设置生效后再添加 show 类
		requestAnimationFrame(() => {
			this.modal.classList.add("show");
		});

		// 聚焦到第一个输入框
		setTimeout(() => {
			this.nameInput.focus();
		}, 300);

		// 阻止背景滚动，使用更温和的方式
		document.body.classList.add("modal-open");
	}

	hide() {
		this.modal.classList.remove("show");

		// 等待动画完成后隐藏和恢复滚动
		setTimeout(() => {
			this.modal.style.display = "none";
			document.body.classList.remove("modal-open");
			this.resetForm();
		}, 300);
	}

	resetForm() {
		this.form.reset();
		this.clearErrors();
	}

	clearErrors() {
		this.nameError.textContent = "";
		this.addressError.textContent = "";
		this.nameInput.style.borderColor = "";
		this.addressInput.style.borderColor = "";
	}

	validateName() {
		const name = this.nameInput.value.trim();

		if (!name) {
			this.showError("name", "请输入频道名称");
			return false;
		}

		if (name.length < 2) {
			this.showError("name", "频道名称至少需要2个字符");
			return false;
		}

		if (name.length > 50) {
			this.showError("name", "频道名称不能超过50个字符");
			return false;
		}

		this.clearError("name");
		return true;
	}

	validateAddress() {
		const address = this.addressInput.value.trim();

		if (!address) {
			this.showError("address", "请输入频道地址");
			return false;
		}

		// 验证URL格式
		try {
			new URL(address);
		} catch {
			this.showError("address", "请输入有效的URL地址");
			return false;
		}

		// 验证是否是M3U8格式
		if (!address.toLowerCase().includes(".m3u8") && !address.toLowerCase().includes("m3u")) {
			this.showError("address", "建议使用M3U8格式的直播流地址");
			return false;
		}

		this.clearError("address");
		return true;
	}

	showError(field, message) {
		if (field === "name") {
			this.nameError.textContent = message;
			this.nameInput.style.borderColor = "var(--error-color)";
		} else if (field === "address") {
			this.addressError.textContent = message;
			this.addressInput.style.borderColor = "var(--error-color)";
		}
	}

	clearError(field) {
		if (field === "name") {
			this.nameError.textContent = "";
			this.nameInput.style.borderColor = "";
		} else if (field === "address") {
			this.addressError.textContent = "";
			this.addressInput.style.borderColor = "";
		}
	}

	async handleSubmit() {
		// 验证所有字段
		const isNameValid = this.validateName();
		const isAddressValid = this.validateAddress();

		if (!isNameValid || !isAddressValid) {
			notification.warning("请修正表单中的错误");
			return;
		}

		const formData = {
			name: this.nameInput.value.trim(),
			url: this.addressInput.value.trim(),
		};

		try {
			// 禁用提交按钮
			this.confirmBtn.disabled = true;
			const originalText = this.confirmBtn.textContent;
			this.confirmBtn.textContent = this.currentMode === "editSource" ? "保存中..." : "添加中...";

			// 根据模式触发不同的事件
			let eventName, successMessage;
			switch (this.currentMode) {
				case "addSource":
					eventName = "addChannelSource";
					successMessage = `频道源 "${formData.name}" 添加成功`;
					break;
				case "editSource":
					eventName = "editChannelSource";
					formData.originalName = this.editingData.name;
					successMessage = `频道源 "${formData.name}" 修改成功`;
					break;
			}

			const event = new CustomEvent(eventName, {
				detail: formData,
				bubbles: true,
			});

			document.dispatchEvent(event);

			// 成功后关闭模态框
			this.hide();
			notification.success(successMessage);
		} catch (error) {
			console.error("操作失败:", error);
			notification.error("操作失败，请重试");
		} finally {
			// 恢复提交按钮
			this.confirmBtn.disabled = false;
			this.confirmBtn.textContent = this.currentMode === "editSource" ? "保存修改" : "添加频道源";
		}
	}
}
