/**
 * 频道检测器类
 * 用于检测m3u8链接是否可用
 */
class ChannelChecker {
	constructor() {
		this.hls = null;
		this.video = null;
		this.checkTimeout = 10000; // 检测超时时间（毫秒）
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
	 * 批量检测频道
	 * @param {Array<{name: string, url: string}>} channels - 频道列表
	 * @param {Function} onProgress - 进度回调函数
	 * @returns {Promise<Array<{name: string, url: string, isAvailable: boolean}>>}
	 */
	async checkChannels(channels, onProgress) {
		const results = [];
		let checkedCount = 0;

		for (const channel of channels) {
			const isAvailable = await this.checkChannel(channel.url);
			results.push({
				...channel,
				isAvailable,
			});

			checkedCount++;
			if (onProgress) {
				onProgress(checkedCount, channels.length);
			}
		}

		return results;
	}
}

// 导出频道检测器实例
export const channelChecker = new ChannelChecker();
