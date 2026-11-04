"""Disposable Docker WordPress runtime. Never points at a hosted installation."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path('/tmp/evpower-wordpress-test')
ENV = dict(os.environ)
for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
    ENV.pop(key, None)
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']

def docker(*args, input=None):
    return subprocess.run(DOCKER + list(args), env=ENV, input=input, text=True, capture_output=True, check=True).stdout.strip()

def wp(*args):
    return docker('exec', 'evpower-wp-test', 'php', '/test/wp-cli.phar', '--allow-root', '--path=/var/www/html', *args)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'wp':
        print(wp(*sys.argv[2:]))
        sys.exit(0)
    if len(sys.argv) > 1 and sys.argv[1] == 'stop':
        for name in ['evpower-wp-test', 'evpower-wp-db-test']:
            print(docker('stop', name))
        sys.exit(0)
    TEMP.mkdir(exist_ok=True, mode=0o700)
    credential_path = TEMP / 'credentials.json'
    if credential_path.exists():
        credentials = json.loads(credential_path.read_text())
    else:
        credentials = {'username': 'evpower-test-admin', 'password': secrets.token_urlsafe(30), 'email': 'admin@example.test'}
        credential_path.write_text(json.dumps(credentials))
        credential_path.chmod(0o600)
    database_password = secrets.token_urlsafe(30)
    env_path = TEMP / 'database.env'
    env_path.write_text('MARIADB_DATABASE=evpower\nMARIADB_USER=evpower\nMARIADB_PASSWORD=' + database_password + '\nMARIADB_RANDOM_ROOT_PASSWORD=yes\n')
    env_path.chmod(0o600)
    wp_env = TEMP / 'wordpress.env'
    wp_env.write_text('WORDPRESS_DB_HOST=evpower-wp-db-test\nWORDPRESS_DB_NAME=evpower\nWORDPRESS_DB_USER=evpower\nWORDPRESS_DB_PASSWORD=' + database_password + '\nWORDPRESS_DEBUG=1\nWORDPRESS_CONFIG_EXTRA=define("WP_ENVIRONMENT_TYPE", "local"); define("DISABLE_WP_CRON", true); define("WP_AUTO_UPDATE_CORE", false); define("WP_DEBUG_DISPLAY", false); define("WP_DEBUG_LOG", true);\n')
    wp_env.chmod(0o600)
    subprocess.run(DOCKER + ['network', 'inspect', 'evpower-wp-test'], env=ENV, capture_output=True).returncode == 0 or docker('network', 'create', 'evpower-wp-test')
    docker('run', '-d', '--name', 'evpower-wp-db-test', '--network', 'evpower-wp-test', '--label', 'evpower.disposable-test=true', '--env-file', str(env_path), 'mariadb:11.4')
    vendor = TEMP / 'vendor'
    vendor.mkdir(exist_ok=True)
    with zipfile.ZipFile(TEMP / 'woocommerce.zip') as archive:
        archive.extractall(vendor)
    for path in (vendor / 'woocommerce').rglob('*'):
        path.chmod(0o755 if path.is_dir() else 0o644)
    (vendor / 'woocommerce').chmod(0o755)
    docker('run', '-d', '--name', 'evpower-wp-test', '--network', 'evpower-wp-test', '--label', 'evpower.disposable-test=true', '-p', '127.0.0.1:8094:80', '--env-file', str(wp_env),
           '--mount', f'type=bind,src={ROOT / "evpower"},dst=/var/www/html/wp-content/themes/evpower,readonly',
           '--mount', f'type=bind,src={ROOT / "evpower-core"},dst=/var/www/html/wp-content/plugins/evpower-core,readonly',
           '--mount', f'type=bind,src={vendor / "woocommerce"},dst=/var/www/html/wp-content/plugins/woocommerce,readonly',
           '--mount', f'type=bind,src={TEMP},dst=/test,readonly',
           '--mount', f'type=bind,src={ROOT / "tests"},dst=/test-scripts,readonly', 'wordpress:php8.3-apache')
    docker('exec', 'evpower-wp-test', 'mkdir', '-p', '/var/www/html/wp-content/mu-plugins')
    docker('exec', 'evpower-wp-test', 'cp', '/test-scripts/mu-test.php', '/var/www/html/wp-content/mu-plugins/evpower-test.php')
    docker('exec', 'evpower-wp-test', 'chmod', '755', '/var/www/html/wp-content/mu-plugins')
    docker('exec', 'evpower-wp-test', 'chmod', '644', '/var/www/html/wp-content/mu-plugins/evpower-test.php')
    for _ in range(30):
        try:
            if wp('config', 'path') and docker('exec', 'evpower-wp-test', 'php', '-r', '$db = new mysqli(getenv("WORDPRESS_DB_HOST"), getenv("WORDPRESS_DB_USER"), getenv("WORDPRESS_DB_PASSWORD"), getenv("WORDPRESS_DB_NAME")); echo $db->ping();') == '1':
                break
        except subprocess.CalledProcessError:
            time.sleep(1)
    else:
        raise RuntimeError('Disposable WordPress did not become ready.')
    print(wp('core', 'install', '--url=http://localhost:8094', '--title=Evpower', '--admin_user=' + credentials['username'], '--admin_password=' + credentials['password'], '--admin_email=' + credentials['email'], '--skip-email'))
    print('WordPress:', wp('core', 'version'))
    print('Local test runtime ready. Test credentials remain in a private file under /tmp.')
