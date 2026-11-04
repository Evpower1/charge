"""Recover the default-post homepage and configure working page routes through the admin UI."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import TEMP, wp

BASE = 'http://localhost:8094'
assert wp('option', 'get', 'home') == BASE
original = json.loads(wp('eval', 'echo wp_json_encode(array("show_on_front"=>get_option("show_on_front"),"page_on_front"=>get_option("page_on_front"),"permalink_structure"=>get_option("permalink_structure")));'))
credentials = json.loads((TEMP / 'credentials.json').read_text())

async def main():
    wp('eval', 'update_option("show_on_front","posts"); update_option("page_on_front",0);')
    wp('rewrite', 'structure', '', '--hard')
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width':1440,'height':1000})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(BASE + '/', wait_until='domcontentloaded')
        await expect(page.locator('main')).to_contain_text('Welcome to WordPress.')
        await page.screenshot(path=str(TEMP / 'setup-before.png'))
        print('PASS: reproduced the default-post homepage with Plain permalink settings')
        await page.goto(BASE + '/wp-login.php', wait_until='domcontentloaded')
        await page.locator('#user_login').fill(credentials['username'])
        await page.locator('#user_pass').fill(credentials['password'])
        await page.locator('#wp-submit').click()
        await page.wait_for_url('**/wp-admin/**')
        await expect(page.get_by_role('heading', name='Finish setting up your Evpower website')).to_be_visible()
        await page.goto(BASE + '/wp-admin/admin.php?page=evpower', wait_until='domcontentloaded')
        await page.get_by_label('Set the Evpower Home page as this WordPress site’s homepage.').check()
        await page.get_by_label('Use Post name URLs, such as /services/', exact=False).check()
        await page.get_by_role('button', name='Create missing starter content', exact=True).click()
        await page.wait_for_url('**evpower_created=1')
        assert wp('option', 'get', 'show_on_front') == 'page'
        assert wp('option', 'get', 'permalink_structure') == '/%postname%/'
        print('PASS: authenticated setup selects the static homepage and named URLs')
        visitor = await browser.new_page()
        await visitor.goto(BASE + '/', wait_until='domcontentloaded')
        await expect(visitor.locator('main h1')).to_contain_text('A better way')
        await visitor.screenshot(path=str(TEMP / 'setup-after.png'))
        for path in ['/services/', '/locations/', '/about/', '/contact/', '/book-charging/', '/faq/']:
            assert (await context.request.get(BASE + path)).status == 200, path
        print('PASS: homepage hero and all six marketing page routes work after setup')
        wp('rewrite', 'structure', '/%year%/%postname%/', '--hard')
        print(wp('--user=evpower-test-admin', 'eval', '$before=get_option("page_on_front"); evpower_setup_content(); if(get_option("permalink_structure")!=="/%year%/%postname%/"||get_option("page_on_front")!==$before){WP_CLI::error("Setup changed unselected options.");} echo "PASS: repeat setup preserves existing URL and homepage choices unless explicitly selected";'))
        assert not errors, errors
        await browser.close()

try:
    asyncio.run(main())
finally:
    wp('eval', '$state=json_decode(' + json.dumps(json.dumps(original)) + ',true); foreach($state as $key=>$value){if($key!=="permalink_structure")update_option($key,$value);}')
    wp('rewrite', 'structure', original['permalink_structure'], '--hard')
