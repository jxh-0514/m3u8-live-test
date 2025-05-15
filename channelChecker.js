/**
 * 频道检测器类
 * 用于检测m3u8链接是否可用
 */
class ChannelChecker {
	constructor() {
		this.hls = null;
		this.video = null;
		this.checkTimeout = 10000; // 检测超时时间（毫秒）
		this.maxConcurrent = 5; // 最大并行检测数
		this.lastCheckedIndex = -1; // 上次检测的索引位置
		this.isChecking = false; // 是否正在检测
		this.currentBatch = []; // 当前正在检测的批次
	}

	/**
	 * 检测m3u8链接是否可用
	 * @param {string} url - m3u8链接地址
	 * @returns {Promise<boolean>} 链接是否可用
	 */
	async checkChannel(url) {
		return new Promise((resolve) => {
			// 创建video元素
			this.video = document.createElement("video");
			this.video.style.display = "none";
			document.body.appendChild(this.video);

			// 创建HLS实例
			if (this.hls) {
				this.hls.destroy();
			}
			this.hls = new Hls({
				debug: false,
				manifestLoadingTimeOut: 5000,
				manifestLoadingMaxRetry: 1,
				levelLoadingTimeOut: 5000,
				levelLoadingMaxRetry: 1,
			});

			// 设置超时定时器
			const timeoutId = setTimeout(() => {
				this.cleanup();
				resolve(false);
			}, this.checkTimeout);

			// 绑定HLS事件
			this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
				clearTimeout(timeoutId);
				this.cleanup();
				resolve(true);
			});

			this.hls.on(Hls.Events.ERROR, (event, data) => {
				if (data.fatal) {
					clearTimeout(timeoutId);
					this.cleanup();
					resolve(false);
				}
			});

			// 加载m3u8
			this.hls.loadSource(url);
			this.hls.attachMedia(this.video);
		});
	}

	/**
	 * 清理资源
	 */
	cleanup() {
		if (this.hls) {
			this.hls.destroy();
			this.hls = null;
		}
		if (this.video) {
			this.video.remove();
			this.video = null;
		}
	}

	/**
	 * 中断当前检测
	 */
	stopChecking() {
		this.isChecking = false;
		// 清理当前批次的检测
		this.currentBatch.forEach((controller) => {
			if (controller && controller.abort) {
				controller.abort();
			}
		});
		this.currentBatch = [];
		this.cleanup();
	}

	/**
	 * 检测单个频道（带中断控制）
	 * @param {Object} channel - 频道信息
	 * @param {AbortController} controller - 中断控制器
	 * @returns {Promise<boolean>} 检测结果
	 */
	async checkChannelWithAbort(channel, controller) {
		try {
			// 如果已经中断，直接返回
			if (!this.isChecking) {
				return false;
			}

			const signal = controller.signal;
			// 创建一个可以被中断的Promise
			const timeoutPromise = new Promise((resolve) => {
				setTimeout(() => resolve(false), this.checkTimeout);
			});

			const checkPromise = this.checkChannel(channel.url);

			// 使用 Promise.race 实现可中断的检测
			const result = await Promise.race([
				checkPromise,
				timeoutPromise,
				new Promise((_, reject) => {
					signal.addEventListener("abort", () => reject(new Error("检测被中断")));
				}),
			]);

			return result;
		} catch (error) {
			if (error.message === "检测被中断") {
				throw error;
			}
			return false;
		}
	}

	/**
	 * 批量检测频道
	 * @param {Array<{name: string, url: string}>} channels - 频道列表
	 * @param {Function} onProgress - 进度回调函数
	 * @param {Function} onChannelChecked - 单个频道检测完成回调
	 * @param {number} startIndex - 开始检测的索引位置
	 * @returns {Promise<Array<{name: string, url: string, isAvailable: boolean}>>}
	 */
	async checkChannels(channels, onProgress, onChannelChecked, startIndex = 0) {
		const results = new Array(channels.length);
		let checkedCount = 0;
		this.lastCheckedIndex = startIndex - 1;
		this.isChecking = true;
		this.currentBatch = [];

		// 初始化结果数组
		for (let i = 0; i < startIndex; i++) {
			if (channels[i].isAvailable !== undefined) {
				results[i] = { ...channels[i] };
				checkedCount++;
			}
		}

		const checkChannel = async (index) => {
			if (index >= channels.length || !this.isChecking) return;

			const channel = channels[index];
			const controller = new AbortController();
			this.currentBatch.push(controller);

			try {
				const isAvailable = await this.checkChannelWithAbort(channel, controller);
				if (this.isChecking) {
					// 只在未中断时更新结果
					results[index] = {
						...channel,
						isAvailable,
					};
					checkedCount++;
					this.lastCheckedIndex = index;

					if (onProgress) {
						onProgress(checkedCount, channels.length);
					}
					if (onChannelChecked) {
						onChannelChecked(results[index], index);
					}
				}
			} catch (error) {
				if (error.message === "检测被中断") {
					throw error;
				}
				if (this.isChecking) {
					// 只在未中断时更新结果
					results[index] = {
						...channel,
						isAvailable: false,
					};
					checkedCount++;
					this.lastCheckedIndex = index;
				}
			} finally {
				const idx = this.currentBatch.indexOf(controller);
				if (idx !== -1) {
					this.currentBatch.splice(idx, 1);
				}
			}
		};

		try {
			// 并行检测
			const runBatch = async (startIdx) => {
				if (!this.isChecking) return;

				const batch = [];
				for (let i = 0; i < this.maxConcurrent && startIdx + i < channels.length; i++) {
					batch.push(checkChannel(startIdx + i));
				}

				try {
					await Promise.all(batch);
					if (this.isChecking && startIdx + this.maxConcurrent < channels.length) {
						await runBatch(startIdx + this.maxConcurrent);
					}
				} catch (error) {
					if (error.message === "检测被中断") {
						throw error;
					}
				}
			};

			await runBatch(startIndex);
		} catch (error) {
			if (error.message === "检测被中断") {
				console.log("检测已被中断");
			}
			throw error;
		} finally {
			this.cleanup();
		}

		return results;
	}

	/**
	 * 获取上次检测的位置
	 * @returns {number} 上次检测的索引位置
	 */
	getLastCheckedIndex() {
		return this.lastCheckedIndex;
	}
}

// 导出频道检测器实例
export const channelChecker = new ChannelChecker();
