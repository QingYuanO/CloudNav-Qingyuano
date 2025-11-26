# CloudNav (云航) - Cloudflare 版

这是一个现代化的、基于 AI 辅助的个人导航站。支持从 Chrome 书签导入，并且可以免费托管在 Cloudflare Pages 上，利用 Cloudflare KV 实现多端数据同步。

## ✨ 主要功能

*   **多端同步**: 利用 Cloudflare KV 存储数据，在公司电脑、家里电脑和手机上看到的导航内容完全一致。
*   **书签导入**: 支持直接导入 Chrome/Edge 导出的 HTML 书签文件。
*   **AI 智能辅助**: 集成 Google Gemini API，自动为链接生成简介、自动分类。
*   **暗黑模式**: 完美支持深色/浅色主题切换。
*   **安全隐私**: 支持设置访问密码，防止他人随意修改您的导航数据。

---

## 🚀 部署教程 (图形化界面)

无需懂代码，只要有 GitHub 账号即可完成部署。

### 第一步：准备 GitHub 仓库
1. 将本项目的所有代码上传到您的 GitHub 仓库中（例如命名为 `my-nav`）。

### 第二步：创建 Cloudflare Pages 项目
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 在左侧菜单点击 **Workers & Pages** -> **Overview**。
3. 点击 **Create application** -> **Pages** -> **Connect to Git**。
4. 选择您刚才创建的 GitHub 仓库 (`my-nav`)。
5. **构建配置 (Build settings)**:
    *   **Framework preset**: 选择 `Create React App` (或者手动填)
    *   **Build command**: `npm run build`
    *   **Build output directory**: `dist` (注意：如果是 Vite 项目通常是 `dist`，如果是 CRA 是 `build`，本项目基于 Vite 结构，请填 `dist`)。
6. 点击 **Save and Deploy**。

### 第三步：创建并绑定 KV 数据库 (用于存储数据)
1. 部署完成后（或者失败也没关系，先配置环境），回到 Cloudflare Dashboard 的 **Workers & Pages**。
2. 点击左侧菜单的 **KV**。
3. 点击 **Create a Namespace**，命名为 `CLOUDNAV_DB`，点击 Add。
4. 回到您的 Pages 项目页面 -> **Settings** -> **Functions**。
5. 找到 **KV Namespace Bindings** 部分，点击 **Add binding**。
    *   **Variable name**: 必须填 `CLOUDNAV_KV` (代码中是这样读取的)。
    *   **KV Namespace**: 选择刚才创建的 `CLOUDNAV_DB`。
6. 点击 **Save**。

### 第四步：设置环境变量 (密码与 AI)
1. 在 Pages 项目页面 -> **Settings** -> **Environment variables**。
2. 点击 **Add variables**，添加以下变量：
    *   `PASSWORD`: 设置一个管理密码（例如 `123456`）。**必填**，否则无法保存数据。
    *   `API_KEY`: Google Gemini 的 API Key (可选，用于 AI 生成描述)。
3. 点击 **Save**。

### 第五步：重新部署
1. 配置完环境变量和 KV 后，必须重新部署才能生效。
2. 点击顶部 **Deployments** 标签 -> 点击最新的那次部署右侧的三个点 -> **Retry deployment**。
3. 等待部署成功，访问 Cloudflare 提供的 `*.pages.dev` 域名即可。

---

## 🌐 绑定自定义域名

1. 在 Pages 项目页面，点击 **Custom domains** 标签。
2. 点击 **Set up a custom domain**。
3. 输入您在 Cloudflare 上解析的域名（例如 `nav.yourdomain.com`）。
4. Cloudflare 会自动修改 DNS 记录，等待生效即可。

---

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发 (注意：本地无法直接连接线上 KV，数据仅保存在本地)
npm start
```

## 📝 常见问题

**Q: 第一次打开为什么是空的？**
A: 点击右下角的“导入 Chrome 书签”或者点击右上角“添加链接”手动添加。

**Q: 保存时提示“密码错误”？**
A: 首次打开网页时会要求输入密码。如果没弹窗，请刷新页面。确保 Cloudflare 环境变量中配置了 `PASSWORD`。

**Q: AI 功能无法使用？**
A: 请检查环境变量 `API_KEY` 是否正确配置，且您的网络环境允许访问 Google Gemini API (Cloudflare Pages 后端通常可以访问)。
