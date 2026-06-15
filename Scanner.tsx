<IfModule mod_rewrite.c>
  RewriteEngine On
  # Si tu app está en una subcarpeta (ej. tusitio.com/app), cambia el RewriteBase a /app/
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  # Si tu app está en una subcarpeta, cambia esto a /app/index.html
  RewriteRule . /index.html [L]
</IfModule>
