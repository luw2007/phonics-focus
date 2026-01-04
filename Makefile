.PHONY: all install build clean help

# 默认目标
all: install build

# 安装依赖
install:
	npm install

# 构建扩展 (生成 zip 包)
build:
	npm run build

# 清理构建产物
clean:
	rm -f phonics-focus.zip

# 显示帮助信息
help:
	@echo "可用命令:"
	@echo "  make install  - 安装依赖 (npm install)"
	@echo "  make build    - 打包扩展 (npm run build -> phonics-focus.zip)"
	@echo "  make clean    - 清理构建产物"
	@echo "  make help     - 显示此帮助信息"
