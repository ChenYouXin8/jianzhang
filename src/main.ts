import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Vant 组件按需引入（unplugin-vue-components 处理模板中的标签），
// 但函数式组件（showToast / showDialog 等）在 JS 中调用，样式需手动引入
import 'vant/es/toast/style'
import 'vant/es/dialog/style'

import '@/styles/tokens.css'
import '@/styles/base.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
