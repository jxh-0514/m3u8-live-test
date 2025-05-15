# IPTV 在线播放器

一个基于 Web 的 IPTV 在线播放器，支持 M3U8 直播流播放。

## 特性

-   支持 M3U8 直播流播放
-   频道列表管理
-   自动重试机制
-   错误处理和提示
-   响应式布局
-   暗色模式支持
-   本地存储支持

## 技术栈

-   DPlayer：强大的 HTML5 播放器
-   HLS.js：HLS 流媒体播放库
-   原生 JavaScript：模块化代码结构

## 安装

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/m3u8-live-player.git
```

2. 安装依赖：

```bash
npm install
```

3. 启动开发服务器：

```bash
npm start
```

## 使用说明

1. 打开浏览器访问 `http://localhost:8080`
2. 在左侧频道列表中选择要播放的频道
3. 或者直接输入 M3U8 地址进行播放

## 常见问题

### CORS 跨域问题

如果遇到 CORS 跨域问题，可以：

1. 使用支持跨域的直播源
2. 使用代理服务器
3. 配置本地代理服务器（如 nginx）

### 播放错误处理

播放器内置了自动重试机制：

1. 遇到错误时会自动重试（最多 3 次）
2. 每次重试间隔时间递增
3. 提供详细的错误提示

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
