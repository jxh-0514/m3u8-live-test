/**
 * 频道检测器类
 * 用于检测m3u8链接是否可用
 */
class ChannelChecker {
	constructor() {
		this.isChecking = false;
		this.lastCheckedIndex = -1;
		this.activeChecks = new Map(); // 存储活跃的检测任务
		this.concurrentLimit = 5; // 并发检测数量
	}

	/**
	 * 检测单个频道
	 * @param {Object} channel - 频道信息
	 * @returns {Promise} 检测结果
	 */
	async checkChannel(channel) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

		try {
			const response = await fetch(channel.url, {
				method: "HEAD",
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			return {
				...channel,
				isAvailable: response.ok,
			};
		} catch (error) {
			clearTimeout(timeoutId);
			return {
				...channel,
				isAvailable: false,
			};
		}
	}

	/**
	 * 批量检测频道
	 * @param {Array} channels - 频道列表
	 * @param {Function} onProgress - 进度回调
	 * @param {Function} onResult - 结果回调
	 * @param {number} startIndex - 开始检测的索引
	 */
	async checkChannels(channels, onProgress, onResult, startIndex = 0) {
		if (this.isChecking) {
			throw new Error("检测已在进行中");
		}

		this.isChecking = true;
		this.activeChecks.clear();

		try {
			let index = startIndex;
			const total = channels.length;

			// 创建检测队列
			const queue = new Array(this.concurrentLimit).fill(null).map(async () => {
				while (this.isChecking && index < total) {
					const currentIndex = index++;
					const channel = channels[currentIndex];

					// 创建新的检测任务
					const checkTask = this.checkChannel(channel);
					this.activeChecks.set(currentIndex, checkTask);

					try {
						const result = await checkTask;
						if (this.isChecking) {
							// 确保检测未被中断
							this.lastCheckedIndex = currentIndex;
							onResult(result, currentIndex);
							onProgress(currentIndex + 1, total);
						}
					} catch (error) {
						console.error(`检测频道失败: ${channel.name}`, error);
					} finally {
						this.activeChecks.delete(currentIndex);
					}
				}
			});

			// 等待所有检测队列完成
			await Promise.all(queue);

			if (!this.isChecking) {
				throw new Error("检测被中断");
			}
		} finally {
			this.isChecking = false;
		}
	}

	/**
	 * 停止检测
	 */
	stopChecking() {
		this.isChecking = false;
		// 取消所有活跃的检测任务
		this.activeChecks.forEach((checkPromise) => {
			if (checkPromise && checkPromise.cancel) {
				checkPromise.cancel();
			}
		});
		this.activeChecks.clear();
	}

	/**
	 * 获取最后检测的索引
	 */
	getLastCheckedIndex() {
		return this.lastCheckedIndex;
	}
}

// 导出频道检测器实例
export const channelChecker = new ChannelChecker();
