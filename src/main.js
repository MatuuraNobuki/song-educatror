import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import 'primeicons/primeicons.css'
import './style.css'
import App from './App.vue'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)

app.use(pinia)
const AppPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '3px',
      sm: '3px',
      md: '3px',
      lg: '3px',
      xl: '3px',
    },
  },
})

app.use(PrimeVue, {
  theme: {
    preset: AppPreset,
    options: {
      darkModeSelector: 'system',
    },
  },
})
app.use(ToastService)
app.use(ConfirmationService)

app.mount('#app')
