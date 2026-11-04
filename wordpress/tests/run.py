"""Run the WordPress suite locally. Creates/reuses only labelled disposable containers."""
import json
from pathlib import Path
import subprocess
import sys
import urllib.request

from runtime import DOCKER, ENV, TEMP, docker, wp

ROOT = Path(__file__).resolve().parents[2]
TEMP.mkdir(mode=0o700, exist_ok=True)
downloads = {
    'woocommerce.zip': 'https://github.com/woocommerce/woocommerce/releases/download/11.2.1/woocommerce.zip',
    'wp-cli.phar': 'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar',
}
for name, url in downloads.items():
    target = TEMP / name
    if not target.exists():
        with urllib.request.urlopen(url, timeout=120) as response:
            target.write_bytes(response.read())
        target.chmod(0o644)
running = []
for name in ['evpower-wp-test', 'evpower-wp-db-test']:
    result = subprocess.run(DOCKER + ['inspect', '--format', '{{index .Config.Labels "evpower.disposable-test"}} {{.State.Running}}', name], env=ENV, capture_output=True, text=True)
    if result.returncode == 0:
        if result.stdout.strip() != 'true true':
            raise RuntimeError('Refusing to reuse a stopped or unrelated container named ' + name)
        running.append(name)
if not running:
    for image in ['wordpress:php8.3-apache', 'mariadb:11.4']:
        print(docker('pull', image))
    subprocess.run([sys.executable, str(Path(__file__).with_name('runtime.py'))], cwd=ROOT, check=True)
elif len(running) != 2:
    raise RuntimeError('Incomplete local test runtime. Inspect the labelled test containers before retrying.')

assert wp('option', 'get', 'home') == 'http://localhost:8094'
print(wp('plugin', 'activate', 'woocommerce', 'evpower-core'))
print(wp('theme', 'activate', 'evpower'))
print(wp('rewrite', 'structure', '/%postname%/', '--hard'))
print(wp('--user=evpower-test-admin', 'eval', '$r=evpower_setup_content(array("homepage"=>true,"identity"=>true,"sample_products"=>true,"classic_checkout"=>true)); if(is_wp_error($r)){WP_CLI::error($r->get_error_message());} echo "Local starter content ready.";'))
print(wp('--user=evpower-test-admin', 'eval-file', '/test-scripts/integration.php'))
fixtures = TEMP / 'fixtures.json'
fixtures.write_text(docker('exec', 'evpower-wp-test', 'cat', '/tmp/evpower-wordpress-fixtures.json'))
fixtures.chmod(0o600)
print(wp('eval', 'global $wpdb; $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE \'_transient_evpower_form_%\' OR option_name LIKE \'_transient_timeout_evpower_form_%\'"); echo "Local test form counters reset.";'))
subprocess.run([sys.executable, '-u', str(Path(__file__).with_name('browser.py'))], cwd=ROOT, check=True)
print('WordPress integration and browser checks passed. Stop only these test servers with: python wordpress/tests/runtime.py stop')
