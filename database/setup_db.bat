@echo off
REM chanlun 数据库设置脚本
REM 需要以管理员权限运行

echo ==========================================
echo 缠论选股系统 - PostgreSQL 数据库设置
echo ==========================================
echo.

REM 检查 psql 是否可用
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 psql 命令，请确保 PostgreSQL 已安装并添加到 PATH
    echo 请手动执行以下 SQL 命令：
    echo.
    echo -- 创建用户
    echo CREATE USER ilei WITH PASSWORD 'cetc54fhc';
    echo.
    echo -- 创建数据库
    echo CREATE DATABASE chanlun OWNER ilei;
    echo.
    echo -- 创建表结构（在 chanlun 数据库中执行）
    echo -- 请参考 database/init_db.sql 文件
    echo.
    pause
    exit /b 1
)

echo [1/5] 检查 PostgreSQL 服务状态...
sc query PostgreSQL >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] PostgreSQL 服务未找到，请确保服务已安装
) else (
    echo [OK] PostgreSQL 服务已安装
)

echo.
echo [2/5] 尝试创建用户 ilei...
psql -U postgres -c "DO $$ BEGIN CREATE USER ilei WITH PASSWORD 'cetc54fhc'; EXCEPTION WHEN duplicate_object THEN null; END $$;" 2>nul
if %errorlevel% equ 0 (
    echo [OK] 用户 ilei 已创建或已存在
) else (
    echo [跳过] 用户创建跳过（可能需要密码验证）
)

echo.
echo [3/5] 尝试创建数据库 chanlun...
psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = 'chanlun'" | findstr "1" >nul 2>&1
if %errorlevel% neq 0 (
    psql -U postgres -c "CREATE DATABASE chanlun OWNER ilei;" 2>nul
    if %errorlevel% equ 0 (
        echo [OK] 数据库 chanlun 已创建
    ) else (
        echo [跳过] 数据库创建跳过（可能需要超级用户权限）
        echo 请手动执行: CREATE DATABASE chanlun OWNER ilei;
    )
) else (
    echo [OK] 数据库 chanlun 已存在
)

echo.
echo [4/5] 尝试创建表结构...
if exist "..\database\init_db.sql" (
    psql -U postgres -d chanlun -f "..\database\init_db.sql" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] 表结构已创建
    ) else (
        echo [警告] 部分表创建可能失败
    )
) else (
    echo [错误] 未找到 init_db.sql 文件
)

echo.
echo [5/5] 验证数据库连接...
psql -U ilei -d chanlun -c "SELECT 'Connection OK' as status;" 2>nul
if %errorlevel% equ 0 (
    echo [OK] 数据库连接测试成功！
) else (
    echo [注意] 无法使用 ilei 用户连接
    echo 请检查 pg_hba.conf 配置，确保允许 ilei 用户连接
    echo 或使用 postgres 用户手动授权:
    echo   GRANT ALL PRIVILEGES ON DATABASE chanlun TO ilei;
)

echo.
echo ==========================================
echo 设置完成
echo ==========================================
echo.
echo 如果遇到问题，请检查：
echo 1. PostgreSQL 服务是否正在运行
echo 2. pg_hba.conf 是否允许密码认证
echo 3. 数据库用户和密码是否正确
echo.
echo .env 文件配置:
echo   DB_HOST=localhost
echo   DB_PORT=5432
echo   DB_USER=ilei
echo   DB_PASSWORD=cetc54fhc
echo   DB_NAME=chanlun
echo.
pause
