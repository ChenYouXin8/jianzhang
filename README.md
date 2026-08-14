# 简账 · 个人记账

> 本地优先、离线可用的个人记账 PWA。**打开即记**，数据默认只保存在你自己的设备上，不上传任何服务器；可选 WebDAV 同步（坚果云等），AES-GCM 加密备份到云端，多设备互通。

---

## ✨ 功能特性

- **3 秒记账**：类型 / 账户 / 分类智能默认，弹出式数字键盘，保存后自动记住「上次使用」，支持连续记账
- **收支转账**：支出 / 收入 / 转账三类交易，多账户管理，账户余额实时计算（不落库、永远可校验）
- **分类体系**：二级分类 + 预设 emoji 图标，支持自定义增删改、排序、禁用
- **统计图表**：月度收支总览、近 6 月趋势、支出 / 收入构成环形图与分类排行（ECharts）
- **预算管理**：按月 + 一级分类设置预算，超额提醒
- **账单管理**：按日分组列表、月份切换、搜索筛选（类型 / 分类 / 账户 / 时间范围）、批量删除、CSV 导出（Excel 可直接打开）
- **WebDAV 同步**：对接坚果云 / Nextcloud / 自建 WebDAV，文件 **AES-GCM 加密**上传，**三路合并**保证多设备同步不丢数据，支持手动 / 记账后自动同步
- **备份恢复**：JSON 全量备份（含格式校验），换设备可完整迁移
- **PWA 离线可用**：可添加到手机主屏，全屏运行，像原生 App 一样

## 🛠️ 技术栈

| 领域 | 技术 |
| --- | --- |
| 框架 | Vue 3 + TypeScript |
| UI 组件 | Vant 4 |
| 状态管理 | Pinia |
| 本地数据库 | Dexie（IndexedDB） |
| 图表 | ECharts |
| 构建 | Vite + vite-plugin-pwa（PWA） |
| 测试 | Vitest（单元测试） + Playwright（E2E） |

## 🚀 快速开始

### 方式一：Windows 一键启动（推荐）

双击 **`start.bat`** —— 自动安装依赖、启动开发服务器并打开浏览器。

### 方式二：命令行

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 → http://localhost:5173
```

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 类型检查 + 生产构建（输出 `dist/`） |
| `npm run preview` | 本地预览生产包 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 单元测试（Vitest） |
| `npm run test:e2e` | E2E 测试（Playwright + Edge） |
| `npm run lint` | ESLint 代码检查 |
| `npm run format` | Prettier 格式化 |
| `npm run icons` | 重新生成 PWA 图标 |

## 📱 使用说明

应用为移动端优先设计，底部 4 个主 Tab + 若干二级页：

| 页面 | 入口 | 功能 |
| --- | --- | --- |
| 记账 | 底部 Tab ① | 净资产 / 本月收支结余总览，快速记账面板（首屏即记），最近记录一键复记 |
| 账单 | 底部 Tab ② | 按日分组列表、月切换、搜索 / 筛选 / 批量管理 / CSV 导出，点击记录可编辑或删除 |
| 统计 | 底部 Tab ③ | 月度总览、近 6 月收支趋势、支出 / 收入构成、分类排行、预算进度 |
| 我的 | 底部 Tab ④ | 账户管理、分类管理、WebDAV 同步、备份恢复入口 |
| 搜索 | 账单页 → 搜索 | 关键词命中「备注 / 分类名 / 账户名」，结果按日分组，点击直接编辑 |
| 账户管理 | 我的 → 账户管理 | 增删改账户、初始余额、账户类型（含信用卡负债方向）、是否计入总资产、归档 |
| 分类管理 | 我的 → 分类管理 | 支出 / 收入两级分类，自定义图标颜色、同级排序；内置分类仅可禁用 |
| 备份恢复 | 我的 → 备份恢复 | JSON 导出 / 导入、CSV 导出（全部 / 按月）、清除全部数据 |
| WebDAV 同步 | 我的 → WebDAV 同步 | 服务器配置、加密密码、自动同步开关、测试连接、强制上传 / 下载 |

### WebDAV 同步（以坚果云为例，完整教程）

同步链路：`浏览器 → 阿里云函数计算（FC）代理 → 坚果云`。
坚果云不支持浏览器直连（无 CORS 头），且 Cloudflare 海外边缘访问国内坚果云会被网络层拦截（HTTP 520），因此需要把代理部署在**国内**（阿里云 FC 免费额度足够）。

**① 部署代理（一次性，约 5 分钟）**

代码在 [`scripts/fc-proxy/index.js`](scripts/fc-proxy/index.js)（可直接上传的打包文件为 [`scripts/fc-proxy.zip`](scripts/fc-proxy.zip)）：

1. 阿里云 → 函数计算 FC → 创建函数 → 类型选「**Web 函数**」→ 运行时 **Node.js 20**
2. 代码上传方式选「通过 ZIP 包上传代码」，上传 `scripts/fc-proxy.zip`
3. 启动命令 `node index.js`，监听端口 `9000`（默认即可），创建
4. 函数详情 → 触发器 → 创建 HTTP 触发器 → 认证选「**无需认证**」
5. 得到公网地址：`https://<函数名>-<uid>-<region>.fcapp.run`（免备案）

> 若需对接其他 WebDAV 服务，可给函数添加环境变量 `WEBDAV_UPSTREAM` 覆盖上游地址（默认坚果云）。

**② 准备坚果云（一次性）**

1. 登录 [坚果云网页版](https://www.jianguoyun.com) → 账户信息 → 安全选项 → **添加应用密码**（记下，不是登录密码）
2. 在网盘根目录**手动新建文件夹「简账」**（坚果云不允许 WebDAV 根目录直接放文件，且不允许程序自动建目录，必须手动建）

**③ 配置简账**

打开「我的 → WebDAV 同步」，填写：

| 配置项 | 值 |
| --- | --- |
| 服务器地址 | `https://<函数名>-<uid>-<region>.fcapp.run/api/webdav/`（FC 地址 + `/api/webdav/`） |
| 用户名 | 坚果云邮箱 |
| 密码 | 坚果云**应用密码**（不是登录密码） |
| 远程路径 | `/简账/simple-ledger-sync.json`（文件夹名必须与坚果云里的一字不差） |
| 加密密码 | 自行设置，用于加密云端文件；**务必牢记，丢失无法解密** |
| 自动同步 | 建议开启：记账保存后自动上传、应用启动时自动拉取 |

点「保存并立即同步」→ 显示「首次同步完成，已上传到云端」即成功。换设备/换域名后重新配置一次，数据自动拉回。

> 通用 WebDAV：也可对接 Nextcloud、自建 WebDAV 等任意标准 WebDAV 服务（无 CORS 问题的服务器可直接填其地址）。若服务器支持 MKCOL/PROPFIND，程序可自动建目录；坚果云 + 阿里云 FC 场景下需手动建文件夹。

## ☁️ 部署上线

项目是纯静态 PWA，构建产物 `dist/` 可部署到任意静态托管。两种方式：

**方式 A：Cloudflare Pages + GitHub 自动部署（推荐）**

1. 把仓库推送到 GitHub，Cloudflare Pages → Create → **Connect to Git** 连接仓库
2. 构建配置（仓库内 [`wrangler.toml`](wrangler.toml) 已固定）：Build command `npm run build`，输出目录 `dist`；`.nvmrc` 指定 Node 22
3. 之后每次 `git push` 自动构建上线

**方式 B：直接上传（Upload assets）**

1. 双击 **`部署.bat`** 构建生产包
2. Cloudflare Pages → Create → Pages → Upload assets，把 `dist` 文件夹拖进去
3. 得到 `https://xxx.pages.dev` 网址；更新时重新构建再拖一次

### 📱 手机端安装（PWA）

手机浏览器打开部署网址后，可添加到桌面像原生 App 一样使用：

**iPhone（Safari）**
1. 用 Safari 打开网址 → 点底部「分享」按钮（方框 + 箭头图标）
2. 下滑点「**添加到主屏幕**」→ 确认添加
3. 桌面出现「简账」图标，点开全屏运行

**安卓（Chrome）**
1. 用 Chrome 打开网址 → 点右上角「⋮」菜单
2. 点「**安装应用**」（或"添加到主屏幕"）
3. 桌面出现「简账」图标

**安卓（Edge）**
1. 用 Edge 打开网址 → 点「⋯」菜单
2. 优先选「**添加到手机**」（真正的 PWA 应用，全屏、离线可用）
   - 若被跳转到 Edge 的「应用信息」页：说明需要「创建快捷方式」权限 → 在应用信息页 → 权限 → 打开「创建快捷方式」，返回后重试
   - 不想折腾权限可改选「**添加到主屏幕**」（快捷方式，功能完全一样，只是打开时带浏览器界面）

> 之前装过旧版的设备：先删除旧图标再重新添加，避免 PWA 旧缓存干扰。

### 📲 手机配置同步（与电脑共用一本账）

新设备安装后本地是空账本，配置一次 WebDAV 同步即可拉取云端数据（参数与电脑端**完全一致**）：

| 配置项 | 填什么 |
| --- | --- |
| 服务器地址 | `https://<函数名>-<uid>-<region>.fcapp.run/api/webdav/`（同电脑端） |
| 用户名 | 坚果云邮箱 |
| 密码 | 坚果云应用密码 |
| 远程路径 | `/简账/simple-ledger-sync.json`（同电脑端） |
| 加密密码 | **与电脑端设置的一模一样**（不一致将无法解密云端文件） |
| 自动同步 | 建议开启 |

点「保存并立即同步」→ 显示「已合并两端数据」或「两端数据一致」即成功。之后手机记账自动同步到坚果云，电脑端下次启动自动拉取，两端互不覆盖。

**常见问题**

- **手机显示旧版本 / 没有同步入口**：删除主屏图标重新添加，或在浏览器设置中清除该网站数据后重开
- **同步提示「认证失败」**：检查用户名与**应用密码**（坚果云网页版 → 安全选项）
- **加密密码忘记**：无法找回（加密设计如此），请在电脑端同步页确认密码并妥善保存；换新设备前务必记下

详见 [部署说明.md](部署说明.md)。

## 🧪 测试

```bash
npm run test        # 单元测试（Vitest，纯函数层，无需浏览器）
npm run test:e2e    # E2E 测试（Playwright + Edge）
npm run lint        # ESLint
npm run typecheck   # TypeScript 类型检查
```

单元测试覆盖：金额 / 余额 / 预算 / 统计 / 导出 / WebDAV 客户端 / 三路合并 / 加密解密 / 同步编排（105 个用例）。

## 📁 项目结构

```
src/
├── components/        # 组件（entry 快速记账 / bills 账单 / chart 图表 / stats 统计 / common 通用）
├── views/             # 页面（Home 记账 / Bills 账单 / Stats 统计 / Settings 我的 + 二级页）
├── stores/            # Pinia（ledger 账本数据源 / ui 界面状态）
├── db/                # Dexie 数据库定义与仓储层（accounts / categories / transactions / budgets / settings）
├── services/          # 纯函数业务层：balance 余额 / stats 统计 / budget 预算 / export 导出
│                      #   webdav WebDAV 客户端 / sync 三路合并 / sync-config 同步配置 / sync-manager 同步编排
├── utils/             # 工具：money 金额（分） / date 日期 / constants 常量 / crypto 加密 / id
├── router/            # 路由（hash 模式，静态部署无需重写规则）
└── styles/            # 全局样式与设计令牌（tokens / base）
functions/
└── api/webdav/[[path]].ts  # Cloudflare Pages Functions：WebDAV 同源代理（海外 WebDAV 场景可用）
scripts/
├── gen-icons.mjs          # 生成 PWA 图标
├── fc-proxy/index.js      # 阿里云 FC 版 WebDAV 代理（国内访问坚果云的推荐方案）
├── fc-proxy.zip           # 上述代码的打包文件（直接上传阿里云 FC）
└── webdav-proxy.js        # 可选：独立 Cloudflare Worker 版 WebDAV CORS 代理
```

## 🔒 数据与隐私

- **默认纯本地**：所有数据仅存储在**当前设备浏览器**（IndexedDB），离线可用，不上传任何服务器
- **加密同步**：开启 WebDAV 同步后，账本以 AES-GCM 加密文件上传到你自己的 WebDAV 空间，云端只能看到密文；WebDAV 密码与加密密码仅存本机，导出备份文件时不包含
- **迁移**：换设备可导出备份 JSON 导入，或在新设备配置同一 WebDAV 自动拉取（换域名同理，重新配置一次即可）
- **注意**：删除浏览器站点数据会清空账本，删除前请先导出备份或完成同步

## ⚠️ 注意事项

- 桌面端为 Vant 触摸组件（数字键盘、日期选择器）做了鼠标兼容层，可拖拽 / 滚轮 / 点击操作
- 记账日期上限 2099-12-31，允许预记未来日期
- 坚果云限制：WebDAV 根目录不能直接放文件（ObjectNotFound），文件夹需在网页版手动创建；免费版有流量限制（约 1GB 上传 / 3GB 下载每月），正常记账同步足够
