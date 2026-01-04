# Phonics Focus - 实施里程碑 (Implementation Milestones)

## 阶段 1：骨架搭建与环境配置 (Phase 1: Skeleton & Environment)
**目标**：建立 Chrome Extension 项目结构，跑通 Hello World。

- [x] **1.1 项目初始化**
  - 创建标准目录结构 (`manifest.json`, `background/`, `content/`, `popup/`)。
  - 配置 `manifest.json` (V3)，声明必要的权限 (`storage`, `activeTab`, `scripting`)。
- [x] **1.2 构建流程**
  - 使用原生 ES Modules，无需构建工具。
  - Service Worker 支持 `type: "module"`。
- [x] **1.3 基础通信打通**
  - 实现 Content Script 与 Background Service Worker 的消息通信。
  - Popup 通过 Chrome Storage 保存和读取设置。

## 阶段 2：核心逻辑移植 (Phase 2: Core Logic Porting)
**目标**：将 `phonics-app` 的核心词典能力移植到浏览器环境。

- [x] **2.1 词典服务适配**
  - 将 `server/services/dictionary.js` 改写为无 Node.js 依赖版本 (`data/dictionary.js`)。
  - CMUdict 数据已转换为 JSON 格式 (`data/cmudict.json`, 4MB)。
  - 通过 `fetch` 在 Service Worker 中异步加载。
- [x] **2.2 规则匹配逻辑**
  - 移植 `data/phonicsData.js`（6大分类，70+发音模式）。
  - 实现 `RuleMatcher` 类 (`data/rule-matcher.js`)。
  - 支持直接匹配和模式匹配（包括 Magic-E 规则）。

## 阶段 3：网页注入与交互 (Phase 3: DOM Injection & UI)
**目标**：实现网页上的单词识别与高亮。

- [x] **3.1 文本提取与遍历**
  - 使用 `TreeWalker` 遍历 DOM 文本节点。
  - 正则分词 `/\b[a-zA-Z]+\b/g`，过滤非文本元素。
- [x] **3.2 高亮渲染引擎**
  - 实现 DOM 替换逻辑：`<span class="phonics-highlight">`。
  - 三种高亮样式：下划线、背景色、文字色。
  - `IntersectionObserver` 优化：仅处理可视区域。
  - `MutationObserver` 监听动态内容。
- [x] **3.3 悬浮提示 (Tooltip)**
  - 显示单词、IPA 音标、规则名称。
  - 发音按钮（Web Speech API）。

## 阶段 4：完善与发布 (Phase 4: Polish & Release)
**目标**：优化体验，准备发布。

- [x] **4.1 Popup 界面开发**
  - 全局开关 Toggle。
  - 当前规则卡片（显示发音和示例词）。
  - 规则分类选择器 + 具体模式选择器。
  - 高亮样式选择器。
  - 发音设置（TTS/真人发音切换，真人发音源选择）。
- [x] **4.2 数据持久化与功能增强**
  - 修复扩展更新时用户选中规则丢失的问题。
  - 增加真人发音源选择（Free Dictionary, 有道, Bing）。
- [x] **4.3 性能调优**
  - [x] 针对长网页 (如 Wikipedia) 进行压力测试。
  - [x] 优化内存占用，确保不导致浏览器卡顿。
    - 实现 LRU 缓存，减少重复单词分析请求。
    - 使用 DocumentFragment 优化 DOM 插入操作。
    - 实现任务分片，平滑滚动时的处理负载。
- [x] **4.4 图标设计**
  - 创建 16/48/128px PNG 图标。

## 项目结构

```
phonics-focus/
├── manifest.json           # Chrome Extension V3 配置
├── background/
│   └── service-worker.js   # 后台服务（词典查询、规则匹配）
├── content/
│   ├── content.js          # 内容脚本（DOM 高亮）
│   └── content.css         # 高亮样式
├── popup/
│   ├── popup.html          # 弹出面板
│   ├── popup.js            # 面板逻辑
│   └── popup.css           # 面板样式
├── data/
│   ├── phonicsData.js      # 发音规则数据
│   ├── rule-matcher.js     # 规则匹配器
│   ├── dictionary.js       # 词典服务
│   └── cmudict.json        # CMUdict 词典 (4MB)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    ├── spec.md             # 产品规格
    └── milestone.md        # 实施里程碑
```

## 安装方法

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `phonics-focus` 目录
