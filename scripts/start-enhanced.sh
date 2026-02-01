#!/bin/bash

# Enhanced OpenClaw Startup Script
# Wrapper to enhance GLM-4.7 capabilities with pre-installed tools

set -e

echo "🚀 Starting Enhanced OpenClaw for GLM-4.7..."

# 设置环境变量
export PATH="/data/tools/bin:/usr/local/bin:/usr/bin:$PATH"
export PYTHONPATH="/data/workspace:$PYTHONPATH"

# 创建必要的目录
mkdir -p /data/.openclaw
mkdir -p /data/workspace
mkdir -p /data/skills/custom
mkdir -p /data/tools/bin

# 检查是否首次运行
if [ ! -f /data/.openclaw/initialized ]; then
    echo "📦 First run detected. Installing enhanced skills..."
    
    # 运行技能安装脚本
    if [ -f /app/scripts/install-skills.sh ]; then
        bash /app/scripts/install-skills.sh
    fi
    
    # 安装记忆系统
    echo "🧠 Installing memory system..."
    if [ -f /app/scripts/install-memory-system.sh ]; then
        bash /app/scripts/install-memory-system.sh
    fi
    
    # 创建工具发现配置
    cat > /data/.openclaw/tool-registry.json << 'EOF'
{
  "tools": {
    "multimedia": {
      "ffmpeg": {
        "path": "/usr/bin/ffmpeg",
        "capabilities": ["video_conversion", "audio_extraction", "streaming"],
        "usage": "ffmpeg -i input.mp4 output.mp3"
      },
      "imagemagick": {
        "path": "/usr/bin/convert",
        "capabilities": ["image_resize", "format_conversion", "effects"],
        "usage": "convert input.jpg -resize 800x600 output.jpg"
      },
      "yt-dlp": {
        "path": "/data/tools/bin/yt-dlp",
        "capabilities": ["youtube_download", "video_download"],
        "usage": "yt-dlp <video_url>"
      }
    },
    "data_processing": {
      "pandas": {
        "type": "python_module",
        "capabilities": ["csv_processing", "data_analysis", "excel_manipulation"]
      },
      "numpy": {
        "type": "python_module",
        "capabilities": ["numerical_computation", "array_operations"]
      }
    },
    "web": {
      "requests": {
        "type": "python_module",
        "capabilities": ["http_requests", "api_calls", "web_scraping"]
      },
      "beautifulsoup4": {
        "type": "python_module",
        "capabilities": ["html_parsing", "web_scraping"]
      }
    }
  }
}
EOF

    # 创建 GLM 增强提示词
    cat > /data/.openclaw/enhanced-system-prompt.txt << 'EOF'
You are an enhanced AI assistant with extensive pre-installed capabilities:

AVAILABLE TOOLS (already installed, ready to use):
1. Multimedia Processing:
   - ffmpeg: Convert videos/audio, extract audio from video
   - imagemagick: Resize, convert, edit images
   - yt-dlp: Download videos from YouTube and other platforms

2. Data Processing:
   - pandas: Process CSV, Excel files, data analysis
   - numpy: Mathematical computations
   - openpyxl: Excel file manipulation

3. Web Interaction:
   - requests: Make HTTP requests, call APIs
   - beautifulsoup4: Parse HTML, scrape websites
   - cheerio (Node.js): Web scraping

4. Image/Audio Processing:
   - Pillow (PIL): Image manipulation in Python
   - pydub: Audio processing
   - sharp (Node.js): Fast image processing

5. File Operations:
   - Read/write any file format
   - Create, modify, delete files
   - Organize directories

HOW TO USE TOOLS:
- When user asks for multimedia tasks, use ffmpeg/imagemagick
- For data tasks, use pandas/numpy
- For web tasks, use requests/beautifulsoup4
- Write Python or Node.js scripts to accomplish complex tasks
- All tools are in /usr/bin or /data/tools/bin

IMPORTANT BEHAVIORS:
1. Don't ask permission to install tools - they're already installed!
2. When user wants something done, immediately write code using available tools
3. Be proactive - if you can do it with pre-installed tools, just do it
4. Store work in /data/workspace
5. Create helper scripts for repetitive tasks
6. Learn from each interaction to improve

EXAMPLE WORKFLOWS:
User: "Download this YouTube video"
You: [Use yt-dlp directly, don't ask to install]

User: "Convert this video to MP3"
You: [Use ffmpeg directly: ffmpeg -i input.mp4 output.mp3]

User: "Analyze this CSV file"
You: [Write Python script using pandas, execute it]

User: "Resize these images"
You: [Use imagemagick or Pillow to batch process]

Remember: You have real capabilities. Use them confidently!
EOF

    # 标记为已初始化
    touch /data/.openclaw/initialized
    echo "✅ Enhanced skills installed successfully!"
fi

# 显示可用工具
echo ""
echo "📋 Available Tools:"
echo "  - ffmpeg (video/audio processing)"
echo "  - imagemagick (image processing)"
echo "  - yt-dlp (video downloads)"
echo "  - Python: pandas, numpy, pillow, pydub, requests, beautifulsoup4"
echo "  - Node.js: axios, sharp, cheerio"
echo ""

# 检查配置文件
if [ ! -f /data/.openclaw/openclaw.json ]; then
    echo "⚠️  No config found, will use setup wizard..."
fi

# 启动 OpenClaw
echo "🎯 Starting OpenClaw Gateway..."
exec node src/index.js
