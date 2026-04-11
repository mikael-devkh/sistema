
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wtteste.app', 
  appName: 'WT apk', // Altere conforme necessário
  webDir: 'dist', // Pasta de build do Vite
  server: {
    androidScheme: 'https'
  }
};

export default config;