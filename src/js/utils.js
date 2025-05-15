/**
 * 工具函数模块
 */
class Utils {
	/**
	 * 解析M3U8频道列表
	 * @param {string} content - M3U8文件内容
	 * @returns {Array<{name: string, url: string}>} 频道列表
	 */
	static parseM3U8(content) {
		const channels = [];
		const lines = content.split("\n");

		lines.forEach((line) => {
			line = line.trim();
			if (!line) return;

			// 解析格式：CCTV1 4M1080,http://example.com/index.m3u8
			const parts = line.split(",");
			if (parts.length === 2) {
				channels.push({
					name: parts[0].trim(),
					url: parts[1].trim(),
				});
			}
		});

		return channels;
	}

	/**
	 * 加载频道列表
	 * @param {string} url - 频道列表URL
	 * @returns {Promise<Array<{name: string, url: string}>>}
	 */
	static async loadChannelList(url) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const content = await response.text();
			return this.parseM3U8(content);
		} catch (error) {
			console.error("加载频道列表失败:", error);
			throw error;
		}
	}

	/**
	 * 检查URL是否有效
	 * @param {string} url - 要检查的URL
	 * @returns {boolean}
	 */
	static isValidUrl(url) {
		try {
			new URL(url);
			return true;
		} catch (e) {
			return false;
		}
	}

	/**
	 * 本地存储管理
	 */
	static storage = {
		/**
		 * 保存数据到本地存储
		 * @param {string} key - 键名
		 * @param {any} value - 要存储的值
		 */
		save(key, value) {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch (e) {
				console.error("保存到本地存储失败:", e);
			}
		},

		/**
		 * 从本地存储获取数据
		 * @param {string} key - 键名
		 * @param {any} defaultValue - 默认值
		 * @returns {any}
		 */
		get(key, defaultValue = null) {
			try {
				const item = localStorage.getItem(key);
				return item ? JSON.parse(item) : defaultValue;
			} catch (e) {
				console.error("从本地存储获取数据失败:", e);
				return defaultValue;
			}
		},

		/**
		 * 从本地存储删除数据
		 * @param {string} key - 键名
		 */
		remove(key) {
			try {
				localStorage.removeItem(key);
			} catch (e) {
				console.error("从本地存储删除数据失败:", e);
			}
		},
	};

	/**
	 * 格式化检测进度
	 * @param {number} current - 当前进度
	 * @param {number} total - 总数
	 * @returns {string} 格式化后的进度字符串
	 */
	static formatProgress(current, total) {
		const percentage = Math.round((current / total) * 100);
		return `检测进度: ${current}/${total} (${percentage}%)`;
	}

	/**
	 * 格式化检测结果
	 * @param {Array<{name: string, url: string, isAvailable: boolean}>} results - 检测结果
	 * @returns {string} 格式化后的结果字符串
	 */
	static formatResults(results) {
		const total = results.length;
		const available = results.filter((r) => r.isAvailable).length;
		const percentage = Math.round((available / total) * 100);

		return `检测完成！\n可用频道: ${available}/${total} (${percentage}%)\n`;
	}
}

// 导出工具类
export default Utils;
