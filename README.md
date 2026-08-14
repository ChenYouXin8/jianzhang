# 简账 · 个人记账

> 本地优先、离线可用的个人记账 PWA。**打开即记**，数据默认只保存在你自己的设备上，不上传任何服务器；可选 WebDAV 同步（坚果云等），加密备份到云端。

---

## ✨ 功能特性

- **3 秒记账**：类型 / 账户 / 分类智能默认，弹出式数字键盘，保存后自动记住「上次使用」，支持连续记账
- **收支转账**：支出 / 收入 / 转账三类交易，多账户管理，账户余额实时计算（不落库、永远可校验）
- **分类体系**：二级分类 + 预设 emoji 图标，支持自定义增删改、排序、禁用
- **统计图表**：月度收支总览、近 6 月趋势、支出 / 收入构成环形图与分类排行（ECharts）
- **预算管理**：按月 + 一级分类设置预算，超额提醒
- **账单管理**：按日分组列表、月份切换、搜索筛选（类型 / 分类 / 账户 / 时间范围）、批量删除、CSV 导出（Excel 可直接打开）
- **WebDAV 同步**：通用 WebDAV 配置（坚果云 / Nextcloud / 自建），文件 **AES-GCM 加密**上传，**三路合并**保证多设备同步不丢数据，支持手动 / 记账后自动同步
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

### WebDAV 同步（以坚果云为例）

1. 进入「我的 → WebDAV 同步」，服务器地址填 `https://dav.jianguoyun.com/dav/`，用户名填坚果云邮箱
2. **密码填「应用密码」**：登录坚果云网页版 → 账户信息 → 安全选项 → 添加应用密码（不是登录密码）
3. 设置「加密密码」：同步文件以 AES-GCM 加密后上传，云端只能看到密文；**该密码务必牢记，丢失将无法解密**
4. 开启「自动同步」：记账保存后自动上传、应用启动时自动拉取；也可以随时手动「保存并立即同步」

> 通用 WebDAV：也可对接 Nextcloud、自建 WebDAV 等任意标准 WebDAV 服务。若目标服务器不支持浏览器跨域（CORS），可将 `scripts/webdav-proxy.js` 部署为 Cloudflare Worker，把服务器地址填 Worker 地址即可。

## ☁️ 部署上线（手机使用）

项目是纯静态 PWA，构建产物 `dist/` 可部署到任意静态托管，无需服务器与数据库：

1. 双击 **`部署.bat`** 构建生产包（会自动打开上传页与 dist 文件夹）
2. 打开 [Cloudflare Pages](https://dash.cloudflare.com) → Create → Pages → **Upload assets**，把 `dist` 文件夹整个拖进去
3. 十几秒后得到 `https://xxx.pages.dev` 网址，手机浏览器打开
4. 安装到主屏幕：iPhone（Safari）→ 分享 → **添加到主屏幕**；Android（Chrome）→ ⋮ → **安装应用**

详见 [部署说明.md](部署说明.md)。

## 🧪 测试

```bash
npm run test        # 单元测试（Vitest，纯函数层，无需浏览器）
npm run test:e2e    # E2E 测试（Playwright + Edge）
npm run lint        # ESLint
npm run typecheck   # TypeScript 类型检查
```

单元测试覆盖：金额 / 余额 / 预算 / 统计 / 导出 / WebDAV 客户端 / 三路合并 / 加密解密 / 同步编排。

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
scripts/
├── gen-icons.mjs      # 生成 PWA 图标
└── webdav-proxy.js    # Cloudflare Worker 版 WebDAV CORS 代理（可选）
```

## 🔒 数据与隐私

- **默认纯本地**：所有数据仅存储在**当前设备浏览器**（IndexedDB），离线可用，不上传任何服务器
- **加密同步**：开启 WebDAV 同步后，账本以 AES-GCM 加密文件上传到你自己的 WebDAV 空间，云端只能看到密文；WebDAV 密码与加密密码仅存本机，导出备份文件时不包含
- **迁移**：换设备可导出备份 JSON 导入，或在新设备配置同一 WebDAV 自动拉取
- **注意**：删除浏览器站点数据会清空账本，删除前请先导出备份或完成同步

## ⚠️ 注意事项

- 桌面端为 Vant 触摸组件（数字键盘、日期选择器）做了鼠标兼容层，可拖拽 / 滚轮 / 点击操作
- 记账日期上限 2099-12-31，允许预记未来日期
- 坚果云免费版有流量限制（约 1GB 上传 / 3GB 下载每月），正常记账同步足够
