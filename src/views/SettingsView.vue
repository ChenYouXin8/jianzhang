<script setup lang="ts">
import { useRouter } from 'vue-router'

/** 我的页：管理入口 + 关于。数据安全说明透明展示（本地优先的信任基础）。 */
const router = useRouter()

const APP_VERSION = '0.1.0'
</script>

<template>
  <main class="page settings">
    <h1 class="page-title">我的</h1>

    <van-cell-group inset title="资产管理">
      <van-cell
        title="账户管理"
        label="账户、初始余额与归档"
        icon="balance-list-o"
        is-link
        data-testid="nav-accounts"
        @click="router.push('/accounts')"
      />
      <van-cell
        title="分类管理"
        label="自定义分类、图标与排序"
        icon="label-o"
        is-link
        data-testid="nav-categories"
        @click="router.push('/categories')"
      />
    </van-cell-group>

    <van-cell-group inset title="数据安全">
      <van-cell
        title="WebDAV 同步"
        label="对接坚果云等，加密备份到云端"
        icon="exchange"
        is-link
        data-testid="nav-sync"
        @click="router.push('/sync')"
      />
      <van-cell
        title="备份与恢复"
        label="导出 / 导入备份，导出 CSV"
        icon="shield-o"
        is-link
        data-testid="nav-backup"
        @click="router.push('/backup')"
      />
    </van-cell-group>

    <van-cell-group inset title="关于">
      <van-cell title="版本" :value="APP_VERSION" />
      <van-cell
        title="数据存储说明"
        label="所有数据仅保存在本机浏览器（IndexedDB），不上传任何服务器；离线可用。请定期导出备份。"
      />
    </van-cell-group>
  </main>
</template>

<style scoped>
.settings {
  padding-top: 24px;
}
.page-title {
  margin: 0 0 16px 4px;
  font-size: 22px;
  font-weight: 700;
}
.settings :deep(.van-cell-group) {
  margin-bottom: 12px;
}
</style>
