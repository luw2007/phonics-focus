# Phonics Focus

![Phonics Focus Logo](icons/icon128.png)

**Phonics Focus** 是一款沉浸式自然拼读伴侣，帮助您在浏览网页时潜移默化地学习英语发音规则。它能自动高亮网页中符合特定拼读规则的单词，让学习变得轻松自然。

[English Documentation](README.md)

## 功能特性

- 📚 **全面的拼读规则**: 涵盖26个基础字母、短元音、长元音、辅音组合、R控制元音及其他元音组合。
- 🔦 **智能高亮**: 自动识别并高亮网页中符合您当前所选规则的单词。
- 🎨 **个性化样式**: 支持下划线、背景色、文字颜色或行内嵌入 IPA 音标，满足不同的阅读习惯。
- 🔊 **发音支持**:
  - **合成发音 (TTS)**: 支持调节语速和选择系统语音。
  - **真人发音**: 集成 Free Dictionary API、有道词典、百度翻译和 Google 翻译音源。
- 🖱️ **交互式学习**: 鼠标悬停查看规则详情和音标，点击即可朗读发音。

## 软件截图

> *请在此处添加截图*

| 插件弹窗 | 网页高亮效果 |
|:---:|:---:|
| ![Popup Menu](screenshots/popup.png) | ![Highlighting](screenshots/content.png) |

## 安装指南

### 方法 1: Chrome 应用商店 (推荐)

> *即将上线*

### 方法 2: 手动安装 (开发者模式)

1.  下载最新的发布包：[下载 .zip](https://github.com/luw2007/phonics-focus/releases)
2.  将下载的文件解压到一个文件夹中 (例如 `phonics-focus`)。
3.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车。
4.  打开右上角的 **开发者模式 (Developer mode)** 开关。
5.  点击左上角的 **加载已解压的扩展程序 (Load unpacked)** 按钮。
6.  选择刚才解压的文件夹 (`phonics-focus`)。
7.  安装完成！您应该能看到浏览器工具栏上出现了 Phonics Focus 的图标。

## 使用说明

1.  点击浏览器工具栏上的 Phonics Focus 图标。
2.  选择一个拼读分类和具体的规则。
3.  刷新当前网页或打开新网页。
4.  符合规则的单词将会被自动高亮。
5.  鼠标悬停在单词上查看详情，点击单词收听发音。

## 致谢

- **[Phonics App](https://github.com/cocojojo5213/phonics-app)**: 灵感来自这款系统化的自然拼读学习应用，启发了将拼读教学融入日常网页浏览的想法。
- **[CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict)**: 本项目使用 CMU 字典进行发音数据和规则匹配。

## 许可证

本项目采用 [MIT License](LICENSE) 许可证。
