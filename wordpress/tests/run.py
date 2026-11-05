"""Run the WordPress suite locally. Creates/reuses only labelled disposable containers."""
import json
from pathlib import Path
import subprocess
import sys
import urllib.request
from zipfile import ZipFile

from runtime import DOCKER, ENV, TEMP, docker, wp

ROOT = Path(__file__).resolve().parents[2]
TEMP.mkdir(mode=0o700, exist_ok=True)
downloads = {
    'woocommerce.zip': 'https://github.com/woocommerce/woocommerce/releases/download/11.2.1/woocommerce.zip',
    'wp-cli.phar': 'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar',
    'elementor.zip': 'https://github.com/elementor/elementor/releases/download/4.3.6/elementor-4.3.6.zip',
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
print(wp('eval', 'foreach(get_option("evpower_pages",array()) as $id){$backup=get_post_meta($id,"_evpower_before_elementor",true);if(is_array($backup)&&get_post_meta($id,"_elementor_edit_mode",true)==="builder"){delete_post_meta($id,"_elementor_edit_mode");delete_post_meta($id,"_elementor_data");wp_update_post(array("ID"=>$id,"post_content"=>wp_slash($backup["content"])));update_post_meta($id,"_wp_page_template",$backup["template"]);}} update_option("evpower_header_footer_mode","wordpress"); echo "Local block-editor baseline restored.";'))
print(wp('plugin', 'activate', 'woocommerce', 'evpower-core'))
print(wp('theme', 'activate', 'evpower'))
print(wp('rewrite', 'structure', '/%postname%/', '--hard'))
print(wp('--user=evpower-test-admin', 'eval', '$r=evpower_setup_content(array("homepage"=>true,"identity"=>true,"sample_products"=>true,"classic_checkout"=>true)); if(is_wp_error($r)){WP_CLI::error($r->get_error_message());} echo "Local starter content ready.";'))
print(wp('--user=evpower-test-admin', 'eval-file', '/test-scripts/integration.php'))
fixtures = TEMP / 'fixtures.json'
fixtures.write_text(docker('exec', 'evpower-wp-test', 'cat', '/tmp/evpower-wordpress-fixtures.json'))
fixtures.chmod(0o600)
print(wp('eval', 'global $wpdb; $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE \'_transient_evpower_form_%\' OR option_name LIKE \'_transient_timeout_evpower_form_%\'"); echo "Local test form counters reset.";'))
subprocess.run([sys.executable, '-u', str(Path(__file__).with_name('setup-browser.py'))], cwd=ROOT, check=True)
subprocess.run([sys.executable, '-u', str(Path(__file__).with_name('browser.py'))], cwd=ROOT, check=True)

# Elementor is tested separately after the WordPress-native journeys above.
vendor = TEMP / 'elementor-runtime'
vendor.mkdir(exist_ok=True)
with ZipFile(TEMP / 'elementor.zip') as archive:
    archive.extractall(vendor)
for path in vendor.rglob('*'):
    path.chmod(0o755 if path.is_dir() else 0o644)
print(docker('cp', str(vendor / 'elementor'), 'evpower-wp-test:/var/www/html/wp-content/plugins/'))
print(wp('plugin', 'activate', 'elementor'))
docker('exec', 'evpower-wp-test', 'mkdir', '-p', '/var/www/html/wp-content/uploads')
docker('exec', 'evpower-wp-test', 'find', '/var/www/html/wp-content/uploads', '-type', 'd', '-exec', 'chmod', '755', '{}', ';')
docker('exec', 'evpower-wp-test', 'find', '/var/www/html/wp-content/uploads', '-type', 'f', '-exec', 'chmod', '644', '{}', ';')
docker('exec', 'evpower-wp-test', 'chown', '-R', 'www-data:www-data', '/var/www/html/wp-content/uploads')
docker('exec', 'evpower-wp-test', 'cp', '/test/wp-cli.phar', '/usr/local/bin/evpower-wp-cli.phar')
docker('exec', 'evpower-wp-test', 'chmod', '644', '/usr/local/bin/evpower-wp-cli.phar')
print(docker('exec', '--user', 'www-data', 'evpower-wp-test', 'php', '/usr/local/bin/evpower-wp-cli.phar', '--path=/var/www/html', '--user=evpower-test-admin', 'eval-file', '/test-scripts/elementor.integration.php'))
fixtures = TEMP / 'elementor-fixtures.json'
fixtures.write_text(docker('exec', 'evpower-wp-test', 'cat', '/tmp/evpower-elementor-fixtures.json'))
fixtures.chmod(0o600)
subprocess.run([sys.executable, '-u', str(Path(__file__).with_name('elementor-browser.py'))], cwd=ROOT, check=True)
print('WordPress integration and browser checks passed. Stop only these test servers with: python wordpress/tests/runtime.py stop')
