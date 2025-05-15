/**
 * 通知模块
 * 处理所有状态提示和错误提示的显示
 */
class NotificationManager {
	constructor() {
		this.notificationElement = document.getElementById("notification");
		this.timeout = null;
	}

	/**
	 * 显示通知
	 * @param {string} message - 通知消息
	 * @param {string} type - 通知类型 (success/info/warning/error)
	 * @param {number} duration - 显示时长（毫秒）
	 */
	show(message, type = "info", duration = 3000) {
		// 清除之前的定时器
		if (this.timeout) {
			clearTimeout(this.timeout);
		}

		// 设置通知样式
		const styles = {
			success: "background-color: rgba(40, 167, 69, 0.9)",
			info: "background-color: rgba(23, 162, 184, 0.9)",
			warning: "background-color: rgba(255, 193, 7, 0.9)",
			error: "background-color: rgba(220, 53, 69, 0.9)",
		};

		this.notificationElement.style.cssText = styles[type] || styles.info;
		this.notificationElement.textContent = message;
		this.notificationElement.classList.remove("hidden");

		// 设置自动隐藏
		this.timeout = setTimeout(() => {
			this.hide();
		}, duration);
	}

	/**
	 * 隐藏通知
	 */
	hide() {
		this.notificationElement.classList.add("hidden");
	}

	/**
	 * 显示成功通知
	 * @param {string} message - 通知消息
	 * @param {number} duration - 显示时长（毫秒）
	 */
	success(message, duration = 3000) {
		this.show(message, "success", duration);
	}

	/**
	 * 显示信息通知
	 * @param {string} message - 通知消息
	 * @param {number} duration - 显示时长（毫秒）
	 */
	info(message, duration = 3000) {
		this.show(message, "info", duration);
	}

	/**
	 * 显示警告通知
	 * @param {string} message - 通知消息
	 * @param {number} duration - 显示时长（毫秒）
	 */
	warning(message, duration = 3000) {
		this.show(message, "warning", duration);
	}

	/**
	 * 显示错误通知
	 * @param {string} message - 通知消息
	 * @param {number} duration - 显示时长（毫秒）
	 */
	error(message, duration = 5000) {
		this.show(message, "error", duration);
	}
}

// 导出通知管理器实例
export const notification = new NotificationManager();
