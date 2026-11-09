"""Integration against the existing, labelled local WordPress test site only."""
import asyncio
import json
from pathlib import Path
import secrets
import sys
from urllib.parse import urlsplit, parse_qs

sys.path.insert(0, '/workspace/charge/wordpress/tests')
from runtime import wp
from playwright.async_api import async_playwright, expect

BASE = 'http://localhost:8094'
SETTINGS = BASE + '/wp-admin/themes.php?page=evpower-emblem-preloader'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())


def option():
    return json.loads(wp('eval', 'echo wp_json_encode(array("exists"=>null!==get_option("evp_loader_options",null),"value"=>get_option("evp_loader_options",null)));'))


def restore(value):
    if value['exists']:
        encoded = json.dumps(json.dumps(value['value']))
        wp('eval', 'update_option("evp_loader_options",json_decode(' + encoded + ',true));')
    else:
        wp('option', 'delete', 'evp_loader_options')


async def login(page, username, password):
    await page.goto(BASE + '/wp-login.php')
    await page.get_by_label('Username or Email Address').fill(username)
    await page.get_by_label('Password', exact=True).fill(password)
    await page.get_by_role('button', name='Log In', exact=True).click()
    await page.wait_for_load_state('domcontentloaded')


async def main():
    assert wp('option', 'get', 'home') == BASE, 'Disposable local site required.'
    original = option()
    subscriber_id = None
    subscriber_name = 'evp-loader-' + secrets.token_hex(4)
    subscriber_password = secrets.token_urlsafe(30)
    try:
        try:
            subscriber_id = wp('user', 'create', subscriber_name, subscriber_name + '@example.test', '--role=subscriber', '--user_pass=' + subscriber_password, '--porcelain')
        except Exception:
            raise RuntimeError('Could not create disposable permission-test user.') from None
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            owner = await browser.new_context(viewport={'width':1440, 'height':1000})
            guest = await browser.new_context(viewport={'width':390, 'height':844})
            page = await owner.new_page()
            await login(page, CREDENTIALS['username'], CREDENTIALS['password'])
            await page.goto(SETTINGS)
            await expect(page.locator('h1')).to_have_text('Evpower Preloader')
            await expect(page.locator('input[name="evp_loader_options[enabled]"]')).to_be_checked()
            await expect(page.locator('input[name="evp_loader_options[session_only]"]')).to_be_checked()
            assert 'evpower-emblem-preloader-css' not in await page.content()
            print('PASS: owner settings are accessible and administration has no loading overlay')

            await page.locator('input[name="evp_loader_options[session_only]"]').uncheck()
            await page.locator('#evp-loader-caption').fill('<b>Ready & charging</b>')
            await page.get_by_role('button', name='Save Changes', exact=True).click()
            await expect(page.locator('#evp-loader-caption')).to_have_value('Ready & charging')
            saved = option()['value']
            assert saved == {'enabled':True, 'session_only':False, 'caption':'Ready & charging'}, saved
            print('PASS: real Settings API form saves frequency/caption and sanitizes HTML')

            visitor = await guest.new_page()
            response = await visitor.goto(BASE + '/', wait_until='networkidle')
            assert response.status == 200
            html = await response.text()
            assert html.count('data-evp-preloader') == 1
            assert html.index('evpower-emblem-preloader-css') < html.index('evpower-emblem-preloader-js-before') < html.index('assets/preloader.js') < html.index('</head>')
            config = await visitor.evaluate('window.evpPreloaderConfig')
            assert config == {'sessionOnly':False, 'maxWait':6000}, config
            await expect(visitor.locator('[data-evp-preloader]')).to_have_count(1)
            await expect(visitor.locator('.evp-preloader__caption')).to_have_text('Ready & charging')
            assert await visitor.locator('.evp-preloader__contacts circle').count() == 6
            for asset in ['preloader.css', 'preloader.js', 'emblem.png']:
                resource = await guest.request.get(BASE + '/wp-content/plugins/evpower-preloader/assets/' + asset)
                assert resource.status == 200, asset
            await expect(visitor.locator('html.evp-is-loading')).to_have_count(0, timeout=8000)
            print('PASS: frontend gets ordered head CSS/config/JS, one overlay, local assets and six charging contacts')

            # Both hooks running in the same request may only emit one overlay.
            single = wp('eval', '$GLOBALS["wp_query"] = new WP_Query(array("page_id"=>get_option("page_on_front")));ob_start();do_action("wp_body_open");do_action("wp_footer");$html=ob_get_clean();echo substr_count($html,"data-evp-preloader");')
            assert single == '1', single
            print('PASS: body-open plus footer fallback renders exactly once')

            for path in ['/cart/', '/checkout/', '/my-account/', '/?elementor-preview=' + str(FIXTURES['layouts']['header']), '/?evpower-layout-preview=' + str(FIXTURES['layouts']['header']), '/?preview=true', '/?post_type=elementor_library&p=' + str(FIXTURES['layouts']['header'])]:
                check = await owner.request.get(BASE + path, max_redirects=0)
                source = await check.text()
                assert 'data-evp-preloader' not in source and 'window.evpPreloaderConfig' not in source, (path,check.status,urlsplit(check.url).path,list(parse_qs(urlsplit(check.url).query)))
                if path == '/?preview=true':
                    print('PASS: WordPress preview request excludes loader before canonical redirect (HTTP ' + str(check.status) + ')')
            for path in ['/wp-json/', '/?feed=rss2', '/wp-admin/post.php?post=' + str(FIXTURES['layouts']['header']) + '&action=elementor']:
                check = await owner.request.get(BASE + path)
                assert 'data-evp-preloader' not in await check.text(), path
            print('PASS: WooCommerce transactions, Elementor editor/template previews, WordPress previews, REST and feeds exclude loader')

            # Invalid nonce cannot change the saved option even for an administrator.
            result = await owner.request.post(BASE + '/wp-admin/options.php', form={
                'option_page':'evp_loader_settings', 'action':'update', '_wpnonce':'invalid',
                'evp_loader_options[caption]':'SHOULD_NOT_SAVE',
            })
            assert result.status == 403, result.status
            assert option()['value'] == saved
            print('PASS: invalid settings nonce is rejected without changing saved options')

            subscriber = await browser.new_context()
            subpage = await subscriber.new_page()
            await login(subpage, subscriber_name, subscriber_password)
            denied = await subscriber.request.get(SETTINGS)
            denied_source = await denied.text()
            assert 'id="evp-loader-caption"' not in denied_source
            denied_save = await subscriber.request.post(BASE + '/wp-admin/options.php', form={
                'option_page':'evp_loader_settings', 'action':'update', '_wpnonce':'invalid',
                'evp_loader_options[caption]':'SUBSCRIBER_SHOULD_NOT_SAVE',
            })
            assert option()['value'] == saved
            assert denied_save.status in [200,302,403], denied_save.status
            print('PASS: subscriber cannot access the settings form or update preloader options')

            await page.goto(SETTINGS)
            await page.locator('input[name="evp_loader_options[enabled]"]').uncheck()
            await page.get_by_role('button', name='Save Changes', exact=True).click()
            assert option()['value']['enabled'] is False
            disabled = await owner.request.get(BASE + '/')
            disabled_source = await disabled.text()
            assert 'data-evp-preloader' not in disabled_source and 'evpower-emblem-preloader-js' not in disabled_source
            print('PASS: disabling through the real admin form removes frontend assets and overlay')
            await browser.close()
    finally:
        restore(original)
        if subscriber_id is not None:
            wp('user', 'delete', subscriber_id, '--yes')
    print('PASS: original option state restored and disposable subscriber removed')


if __name__ == '__main__':
    asyncio.run(main())
