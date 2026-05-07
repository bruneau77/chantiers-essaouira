// Configuration PM2 — gestion des processus Node en production
//
// Usage sur le VPS :
//   pm2 start deploy/ecosystem.config.js
//   pm2 save                                  # Persiste la config
//   pm2 startup                               # Auto-start au reboot
//   pm2 logs                                  # Voir les logs
//   pm2 restart all                           # Redémarrer après git pull

module.exports = {
  apps: [
    {
      name: 'chantiers-api',
      cwd: '/var/app/chantiers-essaouira/backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
        // DATABASE_URL, JWT_SECRET, etc. à mettre dans /var/app/chantiers-essaouira/backend/.env
      },
      error_file: '/var/log/pm2/chantiers-api-error.log',
      out_file: '/var/log/pm2/chantiers-api-out.log',
      time: true,
    },
    {
      name: 'chantiers-web',
      cwd: '/var/app/chantiers-essaouira/frontend',
      script: 'build/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '127.0.0.1',
        ORIGIN: 'http://TON_IP_VPS', // Remplacer par http(s)://ton-domaine quand dispo
      },
      error_file: '/var/log/pm2/chantiers-web-error.log',
      out_file: '/var/log/pm2/chantiers-web-out.log',
      time: true,
    },
  ],
}
