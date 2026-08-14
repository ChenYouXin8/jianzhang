<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showConfirmDialog, showSuccessToast, showToast } from 'vant'
import { useRouter } from 'vue-router'
import { db } from '@/db/database'
import { replaceAllSettings } from '@/db/repositories/settings'
import type { BackupFile } from '@/services/export'
import {
  DEFAULT_SYNC_CONFIG,
  filterSensitiveSettings,
  loadAutoSync,
  loadSyncConfig,
  loadSyncPass,
  loadSyncStatus,
  saveAutoSync,
  saveSyncConfig,
  saveSyncPass,
  type SyncConfig,
  type SyncStatus,
} from '@/services/sync-config'
import {
  buildLocalSnapshot,
  forcePull,
  forcePush,
  performSync,
  type SyncDeps,
  type SyncReport,
} from '@/services/sync-manager'
import { testConnection } from '@/services/webdav'
import { useLedgerStore } from '@/stores/ledger'

/**
 * WebDAV 同步页：通用 WebDAV 配置（可对接坚果云 / Nextcloud / 自建），
 * 快照式三路合并 + AES-GCM 加密。入口在「我的」→ 数据安全。
 */
const router = useRouter()
const ledger = useLedgerStore()

const form = reactive<SyncConfig>({ ...DEFAULT_SYNC_CONFIG })
const encPass = ref('')
const rememberPass = ref(true)
const autoSync = ref(false)
const status = ref<SyncStatus>({
  lastSyncAt: null,
  lastResult: null,
  lastMessage: '',
  lastLocalHash: '',
  lastRemoteHash: '',
})
const busy = ref(false)
const testing = ref(false)

const lastSyncText = computed(() =>
  status.value.lastSyncAt ? new Date(status.value.lastSyncAt).toLocaleString('zh-CN') : '从未同步',
)
const statusText = computed(() => {
  if (!status.value.lastMessage) return status.value.lastResult === 'error' ? '上次同步失败' : '暂无记录'
  return status.value.lastMessage
})

/* ---------------- 依赖注入（构建/写库） ---------------- */

const deps: SyncDeps = {
  buildLocal: async () =>
    buildLocalSnapshot({
      accounts: ledger.accounts,
      categories: ledger.categories,
      transactions: ledger.transactions,
      budgets: ledger.budgets,
      // 排除 sync.* 敏感键，避免 WebDAV 密码 / 加密密码进入云端文件或被合并到其他设备
      settings: filterSensitiveSettings(await db.settings.toArray()),
    }),
  restoreLocal: async (data: BackupFile) => {
    await ledger.restoreBackup({
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
      budgets: data.budgets,
    })
    await replaceAllSettings(data.settings)
  },
}

/* ---------------- 页面加载 ---------------- */

onMounted(async () => {
  const [cfg, pass, auto, st] = await Promise.all([
    loadSyncConfig(),
    loadSyncPass(),
    loadAutoSync(),
    loadSyncStatus(),
  ])
  Object.assign(form, cfg)
  encPass.value = pass
  autoSync.value = auto
  status.value = st
})

/* ---------------- 配置保存 ---------------- */

async function saveForm(): Promise<boolean> {
  if (!form.serverUrl.trim() || !form.username.trim() || !form.password) {
    showToast('请填写完整的服务器地址 / 用户名 / 密码')
    return false
  }
  if (!encPass.value) {
    showToast('请设置同步加密密码（用于加密云端文件）')
    return false
  }
  if (!form.remotePath.startsWith('/')) {
    showToast('远程路径需以 / 开头，例如 /简账/simple-ledger-sync.json')
    return false
  }
  await Promise.all([
    saveSyncConfig({ ...form }),
    saveSyncPass(rememberPass.value ? encPass.value : ''),
    saveAutoSync(autoSync.value),
  ])
  return true
}

/* ---------------- 动作 ---------------- */

function handleReport(r: SyncReport) {
  if (r.kind === 'error') showToast(r.message)
  else if (r.kind === 'skipped' || r.kind === 'noop') showToast(r.message)
  else showSuccessToast(r.message)
}

async function saveAndSync() {
  if (busy.value) return
  if (!(await saveForm())) return
  busy.value = true
  try {
    const report = await performSync(deps)
    if (report.kind === 'manual') {
      const choice = await showConfirmDialog({
        title: '删除改动过大，需手动选择',
        message: `${report.message}\n\n「上传」= 以本机数据为准覆盖云端；「下载」= 以云端数据为准替换本机。`,
        confirmButtonText: '上传（本机为准）',
        cancelButtonText: '下载（云端为准）',
      }).catch(() => 'cancel' as const)
      if (choice === 'cancel') {
        showToast('已取消，未做任何改动')
      } else {
        const pushed = await forcePush(deps)
        handleReport(pushed)
      }
    } else {
      handleReport(report)
    }
    status.value = await loadSyncStatus()
  } finally {
    busy.value = false
  }
}

async function testConn() {
  if (!(await saveForm())) return
  testing.value = true
  try {
    const result = await testConnection({
      serverUrl: form.serverUrl,
      username: form.username,
      password: form.password,
      remotePath: form.remotePath,
    })
    showToast(result.message)
  } finally {
    testing.value = false
  }
}

async function doForcePush() {
  if (busy.value) return
  await showConfirmDialog({
    title: '强制上传',
    message: '将以本机全部数据覆盖云端文件（云端原有内容将被替换）。确定继续吗？',
    confirmButtonText: '上传',
    cancelButtonText: '取消',
  })
  busy.value = true
  try {
    const report = await forcePush(deps)
    handleReport(report)
    status.value = await loadSyncStatus()
  } finally {
    busy.value = false
  }
}

async function doForcePull() {
  if (busy.value) return
  await showConfirmDialog({
    title: '强制下载',
    message: '将以云端文件替换本机全部数据（本机当前改动将被覆盖，建议先确认）。确定继续吗？',
    confirmButtonText: '下载',
    cancelButtonText: '取消',
  })
  busy.value = true
  try {
    const report = await forcePull(deps)
    handleReport(report)
    status.value = await loadSyncStatus()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="sync-page">
    <van-nav-bar title="WebDAV 同步" left-arrow @click-left="router.back()" />

    <div class="page">
      <van-cell-group inset title="服务器配置">
        <van-field
          v-model="form.serverUrl"
          label="服务器地址"
          placeholder="https://dav.jianguoyun.com/dav/"
          clearable
          data-testid="sync-server-url"
        />
        <van-field
          v-model="form.username"
          label="用户名"
          placeholder="WebDAV 账号（坚果云为邮箱）"
          clearable
          data-testid="sync-username"
        />
        <van-field
          v-model="form.password"
          type="password"
          label="密码"
          placeholder="坚果云请填「应用密码」"
          autocomplete="off"
          data-testid="sync-password"
        />
        <van-field
          v-model="form.remotePath"
          label="远程路径"
          placeholder="/simple-ledger-sync.json"
          clearable
          data-testid="sync-remote-path"
        />
      </van-cell-group>

      <van-cell-group inset title="加密与自动同步">
        <van-field
          v-model="encPass"
          type="password"
          label="加密密码"
          placeholder="加密云端文件，必填"
          autocomplete="off"
          data-testid="sync-enc-pass"
        />
        <van-cell title="记住加密密码" label="下次同步无需重复输入（仅存本机）" :border="false">
          <template #right-icon>
            <van-switch v-model="rememberPass" size="20" />
          </template>
        </van-cell>
        <van-cell title="自动同步" label="记账保存后自动同步；启动时自动拉取" :border="false">
          <template #right-icon>
            <van-switch v-model="autoSync" size="20" data-testid="sync-auto" />
          </template>
        </van-cell>
      </van-cell-group>

      <div class="actions">
        <van-button
          block
          type="primary"
          :loading="busy"
          data-testid="sync-now"
          @click="saveAndSync"
        >
          保存并立即同步
        </van-button>
        <div class="actions-row">
          <van-button block plain type="primary" :loading="testing" @click="testConn">
            测试连接
          </van-button>
        </div>
        <div class="actions-row">
          <van-button block plain type="warning" @click="doForcePush">强制上传（以本机为准）</van-button>
          <van-button block plain type="danger" @click="doForcePull">强制下载（以云端为准）</van-button>
        </div>
      </div>

      <van-cell-group inset title="同步状态">
        <van-cell title="上次同步" :value="lastSyncText" />
        <van-cell title="结果" :value="statusText" />
      </van-cell-group>

      <div class="help card">
        <h3 class="help-title">💡 坚果云配置</h3>
        <ol class="help-list">
          <li>服务器地址填 <code>https://dav.jianguoyun.com/dav/</code>，用户名填坚果云邮箱</li>
          <li>密码不是登录密码：登录网页版坚果云 → 账户信息 → 安全选项 → <b>添加应用密码</b>，生成后填到这里</li>
          <li>坚果云不允许在 WebDAV 根目录直接放文件：请先在坚果云网页版新建「简账」文件夹，远程路径填 <code>/简账/simple-ledger-sync.json</code>（文件夹名必须一字不差）</li>
          <li>同步文件以 AES-GCM 加密后上传，云端只能看到密文；加密密码请务必牢记，丢失将无法解密</li>
          <li>免费版坚果云有流量限制（约 1GB 上传 / 3GB 下载每月），正常记账同步足够</li>
        </ol>
        <p class="help-note">
          通用 WebDAV：也可对接 Nextcloud、自建 WebDAV 等。若服务器拒绝浏览器跨域（CORS，
          坚果云直连即会如此），把服务器地址改为 <code>https://你的域名/api/webdav/</code>
          （本仓库内置 Cloudflare Pages 代理，云端转发，无需额外部署），其余照填。
        </p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.sync-page {
  min-height: 100vh;
  background: var(--color-bg);
}
.sync-page :deep(.van-cell-group) {
  margin-bottom: 12px;
}
.actions {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.actions-row {
  display: flex;
  gap: 10px;
}
.actions-row .van-button {
  flex: 1;
}
.help {
  margin: 4px 16px 24px;
  padding: 14px 16px;
}
.help-title {
  margin: 0 0 8px;
  font-size: 14px;
}
.help-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-secondary);
}
.help-list code {
  font-family: inherit;
  color: var(--color-text);
  word-break: break-all;
}
.help-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
