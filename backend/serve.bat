@echo off
cd /d "%~dp0"
php -c php.ini artisan serve %*
