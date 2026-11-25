# 四级词汇大师 (CET-4 Vocab App)

轻量级大学英语四级学习软件（**FastAPI + SQLite + React + Capacitor 安卓 App**），支持：
- **艾宾浩斯 / SM-2 记忆曲线**：认识 / 模糊 / 忘记三档反馈，自动安排下次复习时间。
- **三种背词模式**：卡片记忆、四选一词义测验、拼写默写。
- **错题本**：自动收录遗忘词汇，支持“错题专项消灭”模式。
- **学习统计**：连续打卡天数、今日目标进度、词汇掌握分布、近 14 天学习趋势。
- **多端同步**：自带轻量账号系统，数据持久化保存在服务器 SQLite 中。

---

## 一、部署到你的 Linux 服务器（Docker Compose 一键部署）

> 预计服务器占用：磁盘约 220 MB，内存约 50~120 MB。

1. 将本项目上传到服务器（或通过 Git 克隆），进入项目根目录：
   ```bash
   cd cet4-vocab-app
   ```

2. 修改 `docker-compose.yml` 中的 `CET4_SECRET_KEY` 为任意随机长字符串。

3. 一键构建并启动：
   ```bash
   docker compose up -d --build
   ```

4. 验证服务是否启动成功：
   ```bash
   curl http://127.0.0.1:8000/api/health
   # 返回: {"status":"ok","service":"cet4-vocab-app"}
   ```

5. 放行服务器防火墙 `8000` 端口（或配合 `nginx.conf.example` 配置域名 + HTTPS 反向代理）。

---

## 二、获取安卓 App（两种方式）

### 方式 A：GitHub Actions 云端自动打包 APK（推荐，无需本地装 Android Studio）
1. 将本项目推送到你的 GitHub 仓库（`main` 或 `master` 分支）。
2. 打开仓库页面的 **Actions** 标签页，等待 `Build Android APK` 工作流运行完成。
3. 在工作流底部的 **Artifacts** 中下载 `cet4-vocab-debug-apk`，解压得到 `app-debug.apk`，传到手机直接安装即可。

### 方式 B：本地 Android Studio 构建 APK
1. 安装前端依赖并同步到安卓工程：
   ```bash
   cd frontend
   npm install
   npm run build
   npx cap add android   # 若已存在 android 目录可跳过
   npx cap sync android
   ```
2. 用 Android Studio 打开 `frontend/android` 目录，点击 **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**。

### 安卓 App 连接你的服务器
打开安卓 App 后，在登录页点击 **“安卓 App / 自定义服务器地址设置”**，填入你的服务器地址（例如 `http://你的服务器IP:8000` 或 `https://你的域名`），点击 **测试连接**，提示连接成功后即可注册/登录并同步数据！

> **免安装备选（PWA）**：服务器启动后，直接用手机浏览器访问 `http://你的服务器IP:8000`，在浏览器菜单中选择 **“添加到主屏幕 / 安装应用”**，即可获得接近原生 App 的全屏体验。

---

## 三、本地开发与测试

### 后端
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate  |  Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
pytest -v
uvicorn app.main:app --reload --port 8000
```

### 前端
```bash
cd frontend
npm install
npm run dev
```
