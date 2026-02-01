# Enhanced OpenClaw Railway Template with Pre-installed Tools
# Optimized for GLM-4.7 with maximum capability

FROM node:20-bullseye

# 设置环境变量
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# 安装系统依赖和工具
RUN apt-get update && apt-get install -y \
    # 基础工具
    curl \
    wget \
    git \
    vim \
    nano \
    unzip \
    zip \
    tar \
    # 多媒体处理
    ffmpeg \
    imagemagick \
    libvips-tools \
    # Python 环境
    python3 \
    python3-pip \
    python3-dev \
    # 编译工具
    build-essential \
    g++ \
    make \
    # 网络工具
    net-tools \
    iputils-ping \
    dnsutils \
    # 数据库客户端
    sqlite3 \
    postgresql-client \
    # 其他实用工具
    jq \
    htop \
    tree \
    && rm -rf /var/lib/apt/lists/*

# 升级 pip
RUN pip3 install --upgrade pip setuptools wheel

# 安装常用 Python 库
RUN pip3 install --no-cache-dir \
    # Web 相关
    requests \
    beautifulsoup4 \
    scrapy \
    selenium \
    # 数据处理
    pandas \
    numpy \
    openpyxl \
    xlrd \
    # 图像处理
    pillow \
    opencv-python-headless \
    # 音频处理
    pydub \
    speechrecognition \
    # AI/ML 基础库
    torch --index-url https://download.pytorch.org/whl/cpu \
    transformers \
    # 文档处理
    python-docx \
    pypdf2 \
    markdown \
    # 工具库
    python-dotenv \
    pyyaml \
    colorama \
    tqdm \
    click

# 安装 Node.js 全局包
RUN npm install -g \
    # 文件处理
    sharp \
    jimp \
    # 网络请求
    axios \
    node-fetch \
    # 工具
    pm2 \
    nodemon \
    # 音频/视频
    fluent-ffmpeg

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装项目依赖
RUN npm ci --only=production

# 复制项目文件
COPY . .

# 创建必要的目录
RUN mkdir -p /data/.openclaw /data/workspace /data/skills /data/tools

# 设置权限
RUN chmod -R 755 /data

# 复制技能安装脚本
COPY scripts/install-skills.sh /app/scripts/
RUN chmod +x /app/scripts/install-skills.sh

# 复制记忆系统
COPY memory_system.py /app/
COPY scripts/install-memory-system.sh /app/scripts/
RUN chmod +x /app/scripts/install-memory-system.sh

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 启动命令
CMD ["node", "src/index.js"]
