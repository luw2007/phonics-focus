# Phonics Focus Chrome 扩展开发计划

## 项目概述

基于 `phonics-app` 创建 **Phonics Focus** Chrome 扩展，实现沉浸式自然拼读学习。

---

## 阶段 1：骨架搭建与环境配置

### 1.1 项目初始化
```
phonics-focus/
├── manifest.json          # Chrome Extension V3 配置
├── background/
│   └── service-worker.js  # 后台服务
├── content/
│   ├── content.js         # 内容脚本
│   └── content.css        # 注入样式
├── popup/
│   ├── popup.html         # 弹出面板
│   ├── popup.js
│   └── popup.css
├── data/
│   ├── phonicsData.js     # 移植自 phonics-app
│   └── cmudict.json       # CMUdict 词典 JSON 格式
└── docs/                  # 文档
```

### 1.2 manifest.json 配置
- 权限：`storage`, `activeTab`, `scripting`
- Content Script 匹配所有 HTTP/HTTPS 页面
- Service Worker 常驻后台

### 1.3 基础通信
- Content Script ↔ Background 消息通道
- Popup ↔ Chrome Storage 状态同步

---

## 阶段 2：核心逻辑移植

### 2.1 词典服务适配
- 将 `cmu-pronouncing-dictionary` 转为 JSON（约 4MB）
- 使用 `fetch()` 在 Service Worker 加载
- 实现 ARPABET → IPA 转换

### 2.2 规则匹配逻辑
- 移植 phonicsData.js（6 大分类，70+ 发音模式）
- 实现 `RuleMatcher` 类：
  ```
  输入: word, currentRule
  输出: { matched: boolean, pattern, pronunciation, highlight }
  ```

---

## 阶段 3：网页注入与交互

### 3.1 文本提取
- `TreeWalker` 遍历 DOM 文本节点
- 过滤 `<script>`, `<style>`, `<noscript>` 等非文本元素
- 正则分词：`/\b[a-zA-Z]+\b/g`

### 3.2 高亮渲染
- 匹配词包裹 `<span class="phonics-highlight">`
- 注入 CSS（下划线/背景色可配置）
- `IntersectionObserver` 优化：仅处理可视区域

### 3.3 悬浮提示 (Tooltip)
- 鼠标悬停显示：
  - 单词 + IPA 音标
  - 发音按钮（调用 Web Speech API）
  - 规则名称

---

## 阶段 4：完善与发布

### 4.1 Popup 界面
- 全局开关 (Toggle)
- 当前规则卡片（显示示例词）
- 规则选择器（手动切换）

### 4.2 性能优化
- 长网页分批处理
- 防抖/节流 DOM 操作
- 内存占用监控

### 4.3 发布准备
- Icon 设计（16/48/128px）
- Chrome Web Store 截图
- 使用说明

---

## 技术选型

| 模块 | 方案 |
|------|------|
| 构建 | 原生 ES Modules（无需打包） |
| 词典 | CMUdict JSON + 内存缓存 |
| TTS | Web Speech API (`speechSynthesis`) |
| 样式 | CSS 变量 + 高特异性选择器 |
| 存储 | `chrome.storage.local` |

---

## 开发顺序

1. **Phase 1.1** → 创建目录结构 + manifest.json
2. **Phase 1.3** → 实现 Ping-Pong 通信验证
3. **Phase 2.1** → 词典 JSON 转换 + 加载
4. **Phase 2.2** → RuleMatcher 实现
5. **Phase 3.1** → DOM 文本提取
6. **Phase 3.2** → 高亮渲染引擎
7. **Phase 3.3** → Tooltip 组件
8. **Phase 4.1** → Popup 界面
9. **Phase 4.2** → 性能调优
10. **Phase 4.3** → 发布准备

---

## 预估工作量

- Phase 1: ~2h
- Phase 2: ~4h（词典转换是主要工作）
- Phase 3: ~6h（DOM 操作 + 性能优化）
- Phase 4: ~4h

**总计: ~16h**

---

## 后续扩展方向

### P1 - 学习进度同步
- 与 phonics-app 数据互通
- 服务端 API 同步学习进度

### P2 - 智能推荐
- 根据用户浏览内容推荐学习规则
- 统计高频遇到的单词

### P3 - 游戏化
- 学习积分系统
- 每日打卡挑战

### P4 - 多语言支持
- 支持其他语言的发音学习
- 国际音标扩展
