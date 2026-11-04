"""Production-build browser checks. Run against a disposable demo database.
Requires Python Playwright and Chromium. TEST_BASE_URL defaults to localhost:3001.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:3001')
ARTIFACTS = Path('/tmp/evpower-browser-checks')

async def main():
    ARTIFACTS.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        routes = ['/', '/services', '/locations', '/shop', '/shop/home-7', '/about', '/contact', '/account', '/admin', '/faq', '/privacy', '/terms', '/checkout']
        for route in routes:
            response = await page.goto(BASE + route, wait_until='networkidle')
            assert response.status == 200, (route, response.status)
            assert await page.locator('main h1').count() == 1, route
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), route
        print('PASS: all 13 pages render with a primary heading and no desktop overflow')
        await page.goto(BASE + '/', wait_until='networkidle')
        await page.screenshot(path=str(ARTIFACTS / 'desktop-home.png'), full_page=True)

        for width in [320, 390, 768]:
            await page.set_viewport_size({'width': width, 'height': 844})
            for route in ['/', '/services', '/locations', '/shop', '/shop/home-7', '/contact', '/account', '/admin']:
                await page.goto(BASE + route, wait_until='networkidle')
                assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, route)
            print(f'PASS: eight main pages at {width}px without horizontal overflow')

        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.goto(BASE + '/', wait_until='networkidle')
        await page.screenshot(path=str(ARTIFACTS / 'mobile-home.png'), full_page=True)
        await page.screenshot(path=str(ARTIFACTS / 'mobile-home-viewport.png'))
        await page.get_by_role('button', name='Open navigation').click()
        await page.locator('.main-nav').get_by_role('link', name='Shop', exact=True).click()
        await expect(page).to_have_url(BASE + '/shop')
        print('PASS: mobile navigation')

        await page.set_viewport_size({'width': 1440, 'height': 1000})
        await page.goto(BASE + '/account', wait_until='networkidle')
        await page.get_by_role('button', name='Create an account', exact=True).click()
        email = f'browser-{uuid.uuid4()}@example.com'
        await page.get_by_label('Full name', exact=True).fill('Browser Driver')
        await page.get_by_label('Email address', exact=True).fill(email)
        await page.get_by_label('Password', exact=True).fill(f'Browser-test-{uuid.uuid4()}')
        await page.get_by_role('checkbox').check()
        await page.get_by_role('button', name='Create your account', exact=True).click()
        await expect(page.get_by_role('heading', name='Hello, Browser.')).to_be_visible()
        print('PASS: browser registration and account session')

        await page.goto(BASE + '/shop', wait_until='networkidle')
        await page.get_by_role('button', name='Accessories', exact=True).click()
        await expect(page.locator('.product-card')).to_have_count(2)
        await page.get_by_label('Search products', exact=True).fill('Cable')
        await expect(page.locator('.product-card')).to_have_count(1)
        await page.get_by_role('button', name='Add Type 2 Charging Cable to cart', exact=True).click()
        await page.get_by_role('button', name='Open cart, 1 items', exact=True).click()
        dialog = page.get_by_role('dialog')
        await dialog.get_by_role('button', name='Increase Type 2 Charging Cable quantity').click()
        await expect(dialog.get_by_text('17,000 ETB', exact=True)).to_be_visible()
        await dialog.get_by_role('button', name='Decrease Type 2 Charging Cable quantity').click()
        await dialog.get_by_role('link', name='Continue to checkout').click()
        await page.get_by_label('Phone number', exact=True).fill('+251911000000')
        await page.get_by_label('Street address & nearby landmark', exact=True).fill('Bole, browser testing address')
        await page.get_by_role('checkbox').check()
        await page.get_by_role('button', name='Place demo order').click()
        await expect(page.get_by_role('heading', name='A preview of good things to come.')).to_be_visible()
        await expect(page.get_by_text('Demo · no charge', exact=True)).to_be_visible()
        async with page.expect_popup() as popup:
            await page.get_by_role('link', name='View demo invoice').click()
        invoice = await popup.value
        await expect(invoice.get_by_text('DEMO INVOICE', exact=False)).to_be_visible()
        await invoice.close()
        print('PASS: catalogue filters, cart quantities, guest-capable checkout, and invoice')

        await page.goto(BASE + '/', wait_until='networkidle')
        await page.locator('.hero').get_by_role('button', name='Book a charge').click()
        dialog = page.get_by_role('dialog')
        date = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
        await dialog.get_by_label('Preferred date').fill(date)
        await dialog.get_by_label('Your location').fill('Bole, near the test landmark')
        await dialog.get_by_role('button', name='Continue', exact=True).click()
        await dialog.get_by_label('Phone number').fill('+251911000000')
        await dialog.get_by_role('button', name='Request booking').click()
        await expect(dialog.get_by_role('heading', name='Your booking request is in.')).to_be_visible()
        await dialog.get_by_role('button', name='Back to exploring').click()
        print('PASS: multi-step booking request')

        await page.goto(BASE + '/locations', wait_until='networkidle')
        await page.get_by_role('button', name='Adama', exact=True).click()
        await expect(page.get_by_role('button', name='View Adama charging hub, sample location')).to_be_visible()
        await page.get_by_role('checkbox', name='Verified only').check()
        await expect(page.get_by_role('heading', name='No matching locations yet.')).to_be_visible()
        await page.get_by_role('button', name='Show sample locations').click()
        await page.get_by_role('button', name='Zoom in on map').click()
        print('PASS: city filtering, map interaction, and verified-only empty state')

        await page.goto(BASE + '/contact?topic=Business%20partnership', wait_until='networkidle')
        await expect(page.get_by_role('combobox', name='How can we help?', exact=True)).to_have_value('Business partnership')
        partner_name = 'Browser Partner ' + uuid.uuid4().hex[:8]
        await page.get_by_label('Full name', exact=True).fill(partner_name)
        await page.get_by_label('Email address', exact=True).fill(email)
        await page.get_by_label('Your message').fill('We would like to discuss workplace charging for our business.')
        await page.get_by_role('checkbox').check()
        await page.get_by_role('button', name='Send your message').click()
        await expect(page.get_by_role('heading', name='Thanks for reaching out.')).to_be_visible()
        print('PASS: partnership contact form persists successfully')

        await page.goto(BASE + '/account', wait_until='networkidle')
        await expect(page.get_by_text('Type 2 Charging Cable', exact=False)).to_be_visible()
        await page.get_by_role('button', name='Addresses', exact=True).click()
        await page.get_by_role('button', name='Add a new address').click()
        dialog = page.get_by_role('dialog')
        await dialog.get_by_label('Address label').fill('Work')
        await dialog.get_by_label('Street address & landmark').fill('Kazanchis test office')
        await dialog.get_by_label('Phone number').fill('+251911000000')
        await dialog.get_by_role('button', name='Save address').click()
        await expect(page.get_by_role('heading', name='Work', exact=True)).to_be_visible()
        await page.get_by_role('button', name='Bookings', exact=True).click()
        await expect(page.get_by_text('Mobile EV Charging', exact=True)).to_be_visible()
        print('PASS: account purchase history, saved addresses, and booking history')

        await page.goto(BASE + '/admin', wait_until='networkidle')
        await page.get_by_role('button', name='Products', exact=True).click()
        await page.get_by_role('button', name='Edit', exact=True).first.click()
        dialog = page.get_by_role('dialog')
        await dialog.get_by_label('Stock quantity').fill('23')
        await dialog.get_by_role('button', name='Save changes').click()
        await expect(page.get_by_text('23 available', exact=True)).to_be_visible()
        await page.get_by_role('button', name='Content', exact=True).click()
        await page.get_by_label('Announcement bar').fill('Good energy. Browser-tested journeys.')
        await page.get_by_role('button', name='Save content').click()
        await expect(page.locator('.topbar').get_by_text('Good energy. Browser-tested journeys.')).to_be_visible()
        await page.get_by_role('button', name='Enquiries', exact=False).click()
        await expect(page.get_by_role('heading', name=partner_name + ' · Business partnership', exact=True)).to_be_visible()
        print('PASS: administration updates inventory/content and receives enquiries')
        assert not errors, errors
        print('PASS: no browser exceptions or console errors')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
