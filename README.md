# 简账 · 个人记账

本地优先、离线可用的个人记账 PWA。打开即记，数据只存在你自己的设备上，不上传任何服务器。

## ✨ 功能

- **3 秒记账**：类型 / 账户 / 分类智能默认，弹出式数字键盘，保存后自动记住「上次使用」，支持连续记账
- **收支转账**：支出 / 收入 / 转账三类，多账户管理，账户余额实时计算
- **分类体系**：二级分类 + 预设图标，可自定义增删改
- **统计图表**：月度趋势、收支结构、分类排行（ECharts 图表）
- **预算管理**：月度预算、超额提醒
- **账单管理**：按日分组列表、月切换、搜索筛选、CSV 导出
- **备份恢复**：JSON 全量备份（含校验），换设备可完整迁移
- **PWA 离线可用**：可添加到手机主屏，像原生 App 一样全屏运行

## 🛠 技术栈

| 领域 | 技术 |
| --- | --- |
| 框架 | Vue 3 + TypeScript |
| UI 组件 | Vant 4 |
| 状态管理 | Pinia |
| 本地数据库 | Dexie（IndexedDB） |
| 图表 | ECharts |
| 构建 | Vite + vite-plugin-pwa |
| 测试 | Vitest（单元）+ Playwright（E2E） |

## 🚀 快速开始

### 方式一：一键启动（推荐）

Windows 下双击 **`start.bat`** —— 自动安装依赖、启动服务并打开浏览器。

### 方式二：命令行

```bash
npm install
npm run dev        # http://localhost:5173
```

### 脚本

```bash
npm run dev        # 开发服务器
npm run build      # 类型检查 + 生产构建（输出 dist/）
npm run preview    # 本地预览生产包
npm run typecheck  # TypeScript 类型检查
npm run test       # 单元测试（Vitest）
npm run test:e2e   # E2E 测试（Playwright + Edge）
npm run lint       # ESLint
npm run format     # Prettier
```

## 📱 在手机上使用

1. 双击 **`部署.bat`** 构建生产包
2. 打开 [Cloudflare Pages](https://dash.cloudflare.com) → Create → Pages → Upload assets，把 `dist` 文件夹拖进去
3. 得到 `https://xxx.pages.dev` 网址，手机浏览器打开
4. iPhone：Safari → 分享 → **添加到主屏幕**；Android：Chrome → ⋮ → **安装应用**

详见 [部署说明.md](部署说明.md)。

## 🔒 数据与隐私

- 所有数据仅存储在**当前设备浏览器本地**（IndexedDB），离线可用，不上传任何服务器
- 换设备 = 新账本，请定期在「设置 → 备份与恢复」导出备份 JSON
- 删除浏览器站点数据会清空账本，删除前请先备份

## 📁 项目结构

```
src/
├── components/     # 组件（快速记账 / 账单 / 图表 / 通用）
├── views/          # 页面（首页 / 账单 / 账户 / 统计 / 预算 / 设置…）
├── stores/         # Pinia（账本 ledger / 界面状态 ui）
├── db/             # Dexie 数据库与仓储层
├── services/       # 业务逻辑（余额 / 统计 / 预算 / 导出）
├── utils/          # 工具（金额 / 日期 / 常量）
├── router/         # 路由（hash 模式）
└── styles/         # 全局样式与设计令牌
scripts/gen-icons.mjs   # 生成 PWA 图标
```

## ⚠️ 说明

- 桌面端为 Vant 触摸组件（数字键盘、日期选择器）做了鼠标兼容层，可拖拽 / 滚轮 / 点击操作
- 记账日期上限 2099-12-31，允许预记未来日期
