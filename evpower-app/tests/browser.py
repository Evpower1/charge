"""Real local API + Expo web + operator acceptance checks.

Run against a temporary fixture database with payments and outbound email
disabled. An operator must already be provisioned by the API administrator CLI.
Credentials are read from a private, untracked JSON file; never pass passwords
on the command line. Only loopback servers are accepted. No real checkout,
external map, call, WhatsApp or email action is opened.

Example:
  python evpower-app/tests/browser.py --base http://127.0.0.1:4100 \
      --credentials /tmp/evpower-fixture-credentials.json

The credentials file contains {"adminEmail": "...", "adminPassword": "..."}.
Playwright Python and /usr/bin/chromium must be installed.
"""
import argparse
import asyncio
import json
from pathlib import Path
import re
import uuid
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect


async def request(client, base, method, path, *, token=None, body=None, expected=200):
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    response = await client.fetch(base + path, method=method, headers=headers, data=body)
    data = await response.json() if response.status != 204 else None
    assert response.status == expected, {'method': method, 'path': path, 'status': response.status, 'response': data}
    return data


async def no_overflow(page, label):
    result = await page.evaluate('''() => ({
        width:innerWidth,document:document.documentElement.scrollWidth,
        body:document.body.scrollWidth
    })''')
    assert result['document'] <= result['width'] and result['body'] <= result['width'], (label, result)


async def select_tab(page, name):
    await page.get_by_role('tab', name=name, exact=True).click()


async def screenshot(page, output, name):
    await page.screenshot(path=str(output / (name + '.png')), full_page=True)


async def main(args):
    base = args.base.rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme not in ['http', 'https'] or parsed.hostname not in ['127.0.0.1', 'localhost', '::1'] or parsed.path not in ['', '/']:
        raise SystemExit('Acceptance tests require a loopback fixture API, never a public or production service.')
    credentials = json.loads(args.credentials.read_text())
    if not credentials.get('adminEmail') or not credentials.get('adminPassword'):
        raise SystemExit('The private fixture JSON must contain adminEmail and adminPassword.')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    unique = uuid.uuid4().hex[:10]
    customer = {
        'name': 'Browser Fixture ' + unique,
        'email': 'browser-' + unique + '@example.invalid',
        'phone': '+251922123456',
        'password': 'Browser-fixture-' + uuid.uuid4().hex,
    }
    plate = 'TEST-' + unique.upper()
    station_name = 'Browser fixture station ' + unique
    subject = 'Browser fixture support ' + unique
    js_errors = []
    blocked_external = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)

        async def restrict_to_fixture(route):
            url = urlparse(route.request.url)
            if url.scheme in ['data', 'blob'] or url.hostname in ['127.0.0.1', 'localhost', '::1']:
                await route.continue_()
            else:
                blocked_external.append(url.hostname)
                await route.abort()

        await context.route('**/*', restrict_to_fixture)
        page = await context.new_page()
        page.on('pageerror', lambda error: js_errors.append(str(error)))
        config = await request(context.request, base, 'GET', '/v1/config')
        assert config['paymentsEnabled'] is False, 'Fixture API must have real payment credentials disabled.'

        await page.goto(base + args.app_path, wait_until='networkidle')
        await expect(page.get_by_role('tab', name='Home', exact=True)).to_be_visible()
        await expect(page.get_by_text('Connecting your journey…', exact=True)).to_have_count(0)
        await expect(page.get_by_text('Let’s reconnect', exact=True)).to_have_count(0)
        for width in [320, 390, 1440]:
            await page.set_viewport_size({'width': width, 'height': 900 if width == 1440 else 844})
            await no_overflow(page, 'guest home ' + str(width))
        await page.set_viewport_size({'width': 390, 'height': 844})
        await screenshot(page, output, 'guest-home-390')

        await page.get_by_role('button', name=re.compile('Sign in')).first.click()
        await page.get_by_role('button', name='Create account', exact=True).click()
        await page.get_by_label('Full name', exact=True).fill(customer['name'])
        await page.get_by_label('Email address', exact=True).fill(customer['email'])
        await page.get_by_label('Phone number', exact=True).fill(customer['phone'])
        await page.get_by_label('Password', exact=True).fill(customer['password'])
        await page.get_by_role('button', name='Read privacy notice and service terms', exact=True).click()
        await expect(page.get_by_text(re.compile('Evpower uses your account, vehicle and booking details'))).to_be_visible()
        await page.get_by_role('checkbox').click()
        await page.get_by_role('button', name='Create my account', exact=True).click()
        await expect(page.get_by_role('button', name='Notifications and account', exact=True)).to_be_visible()

        session = await request(context.request, base, 'POST', '/v1/auth/login', body={'email': customer['email'], 'password': customer['password']})
        customer_token = session['accessToken']
        assert session['user']['role'] == 'customer' and session['user']['email'] == customer['email']
        print('PASS: customer registration through the app, privacy notice and real authenticated account', flush=True)

        await select_tab(page, 'Account')
        await page.get_by_role('button', name=re.compile('^My vehicles')).click()
        await page.get_by_label('Make', exact=True).fill('Fixture Motors')
        await page.get_by_label('Model', exact=True).fill('Test EV')
        await page.get_by_label('Plate number', exact=True).fill(plate)
        await page.get_by_label('Battery capacity in kWh', exact=True).fill('60')
        await page.get_by_role('button', name='Save vehicle', exact=True).click()
        await expect(page.get_by_role('button', name='Edit ' + plate, exact=True)).to_be_visible()
        vehicles = await request(context.request, base, 'GET', '/v1/vehicles', token=customer_token)
        vehicle = next(item for item in vehicles['items'] if item['plate'] == plate)
        assert vehicle['connector'] == 'CCS2' and vehicle['batteryKwh'] == 60

        await page.get_by_role('button', name=re.compile('^Saved addresses')).click()
        await page.get_by_label('Address label', exact=True).fill('Fixture pickup')
        await page.get_by_label('Street address and landmark', exact=True).fill('A local browser fixture address near the test landmark')
        await page.get_by_role('button', name='Save address', exact=True).click()
        await expect(page.get_by_role('button', name='Remove Fixture pickup', exact=True)).to_be_visible()
        addresses = await request(context.request, base, 'GET', '/v1/addresses', token=customer_token)
        assert any(item['label'] == 'Fixture pickup' for item in addresses['items'])
        print('PASS: vehicle and saved-address forms persist real customer-owned records', flush=True)

        await select_tab(page, 'Book charge')
        await page.get_by_label('Pickup address or landmark', exact=True).fill('Browser fixture pickup at the main test landmark')
        await page.get_by_label('Requested energy in kWh', exact=True).fill('15')
        await page.get_by_role('button', name=re.compile('Fixture Motors.*' + re.escape(plate))).click()
        await page.get_by_label('Booking notes', exact=True).fill('Local fixture only. No dispatch or outbound message is requested.')
        await page.get_by_role('button', name=re.compile('Request mobile charging')).click()
        await expect(page.get_by_text('You’re on our list.', exact=True)).to_be_visible()
        bookings = await request(context.request, base, 'GET', '/v1/bookings', token=customer_token)
        booking = next(item for item in bookings['items'] if item['vehicleId'] == vehicle['id'])
        assert booking['status'] == 'requested' and booking['quoteMinor'] is None and booking['paymentStatus'] == 'unpaid'
        assert booking['requestedKwh'] == 15 and booking['city'] == 'Addis Ababa'
        await screenshot(page, output, 'booking-received-390')
        print('PASS: mobile charging request persists without an invented price, payment or dispatch', flush=True)

        operator = await context.new_page()
        operator.on('pageerror', lambda error: js_errors.append(str(error)))
        await operator.set_viewport_size({'width': 1440, 'height': 1000})
        await operator.goto(base + '/operator/', wait_until='networkidle')
        await operator.locator('#login-email').fill(credentials['adminEmail'])
        await operator.locator('#login-password').fill(credentials['adminPassword'])
        await operator.locator('#login-submit').click()
        await expect(operator.locator('#workspace')).to_be_visible()
        await expect(operator.locator('#metrics .metric')).to_have_count(4)
        await operator.locator('#recent-bookings').get_by_role('button', name='Open request ' + booking['reference'], exact=True).click()
        await operator.locator('#booking-quote').fill('123.45')
        await operator.locator('#booking-status').select_option('confirmed')
        await operator.locator('#booking-note').fill('Fixture quote confirmed. Payment is required before dispatch.')
        await operator.locator('#booking-save').click()
        await expect(operator.locator('#booking-dialog')).to_be_hidden()
        confirmed = await request(context.request, base, 'GET', '/v1/bookings/' + booking['id'], token=customer_token)
        assert confirmed['status'] == 'confirmed' and confirmed['quoteMinor'] == 12345
        assert confirmed['paymentStatus'] == 'unpaid'
        await no_overflow(operator, 'operator desktop')
        await screenshot(operator, output, 'operator-overview-1440')

        await operator.locator('[data-view="stations"]').click()
        await operator.locator('#new-station').click()
        await operator.locator('#station-name').fill(station_name)
        await operator.locator('#station-address').fill('Browser fixture only — not a real charging station')
        await operator.locator('#station-latitude').fill('9.0301')
        await operator.locator('#station-longitude').fill('38.7502')
        await operator.locator('[name="connectorId"]').fill('browser-port-' + unique)
        await operator.locator('[name="connectorPower"]').fill('60')
        await operator.locator('#station-save').click()
        await expect(operator.locator('#station-dialog')).to_be_hidden()
        card = operator.locator('.station-card').filter(has=operator.get_by_role('heading', name=station_name, exact=True))
        await expect(card).to_contain_text('Draft')
        await expect(card).to_contain_text('Unknown')
        stations = await request(context.request, base, 'GET', '/v1/stations')
        assert not any(item['name'] == station_name for item in stations['items']), 'Unverified drafts must not be public.'
        await card.get_by_role('button', name='Edit location →', exact=True).click()
        await operator.locator('#station-verified').check()
        await operator.locator('#station-address').fill('Edited browser fixture only — not a real charging station')
        await operator.locator('#station-save').click()
        await expect(operator.locator('#station-dialog')).to_be_hidden()
        await expect(card).to_contain_text('Verified')
        stations = await request(context.request, base, 'GET', '/v1/stations')
        station = next(item for item in stations['items'] if item['name'] == station_name)
        assert station['verified'] is True and station['connectors'][0]['status'] == 'unknown'
        assert station['availableCount'] == 0 and station['connectors'][0]['lastSeenAt'] is None
        print('PASS: real operator login, quote confirmation, station creation/editing, draft privacy and unknown availability', flush=True)

        await select_tab(page, 'Stations')
        await page.get_by_label('Search charging locations', exact=True).fill(station_name)
        await expect(page.get_by_role('button', name='Select ' + station_name, exact=True)).to_be_visible()
        await expect(page.get_by_text('Availability unknown', exact=True)).to_be_visible()
        await expect(page.get_by_text('Status unknown', exact=True)).to_be_visible()
        await screenshot(page, output, 'stations-unknown-390')
        await page.get_by_role('switch', name='Show only available chargers', exact=True).click()
        await expect(page.get_by_text('No locations match these filters', exact=True)).to_be_visible()
        await page.get_by_role('switch', name='Show only available chargers', exact=True).click()
        print('PASS: customer locations show a verified station but never invent live availability', flush=True)

        await select_tab(page, 'Activity')
        await page.get_by_role('button', name='View request ' + booking['reference'], exact=True).click()
        await expect(page.get_by_text('123.45', exact=False).first).to_be_visible()
        await page.get_by_role('button', name=re.compile('Pay confirmed quote')).click()
        await page.get_by_role('button', name='Confirm payment', exact=True).click()
        await expect(page.get_by_role('alert')).to_contain_text(re.compile('credit|balance|funds', re.I))
        wallet = await request(context.request, base, 'GET', '/v1/wallet', token=customer_token)
        assert wallet['balanceMinor'] == 0 and wallet['transactions'] == []
        unchanged = await request(context.request, base, 'GET', '/v1/bookings/' + booking['id'], token=customer_token)
        assert unchanged['paymentStatus'] == 'unpaid'
        await page.get_by_role('button', name='Keep reviewing', exact=True).click()
        await page.get_by_role('button', name='Cancel this request', exact=True).click()
        await page.get_by_role('button', name='Yes, cancel request', exact=True).click()
        await expect(page.get_by_text('Cancelled', exact=True).first).to_be_visible()
        cancelled = await request(context.request, base, 'GET', '/v1/bookings/' + booking['id'], token=customer_token)
        assert cancelled['status'] == 'cancelled'
        print('PASS: activity quote/payment flow rejects insufficient credit without debiting, then cancellation persists', flush=True)

        await select_tab(page, 'Account')
        await page.get_by_role('button', name=re.compile('^Evpower service credit')).click()
        await expect(page.get_by_text('Top-ups are not available yet', exact=True)).to_be_visible()
        await expect(page.get_by_role('button', name='Continue to Chapa →', exact=True)).to_be_disabled()
        await expect(page.get_by_label('Top-up amount in Ethiopian birr', exact=True)).not_to_be_editable()
        wallet = await request(context.request, base, 'GET', '/v1/wallet', token=customer_token)
        assert wallet['balanceMinor'] == 0 and wallet['paymentsEnabled'] is False and wallet['transactions'] == []
        await screenshot(page, output, 'wallet-disabled-390')
        for width in [320, 390, 1440]:
            await page.set_viewport_size({'width': width, 'height': 900 if width == 1440 else 844})
            await no_overflow(page, 'wallet ' + str(width))
        await page.set_viewport_size({'width': 390, 'height': 844})
        print('PASS: wallet shows the actual zero balance, disabled top-ups and no imaginary service credit', flush=True)

        await select_tab(page, 'Account')
        await page.get_by_role('button', name=re.compile('^Help & support')).click()
        await page.get_by_label('Subject', exact=True).fill(subject)
        await page.get_by_label('How can we help?', exact=True).fill('Local browser fixture enquiry. Do not contact anyone or dispatch a service.')
        await page.get_by_role('button', name='Send request', exact=True).click()
        await expect(page.get_by_label('Subject', exact=True)).to_have_value('')
        await operator.locator('#refresh').click()
        await operator.locator('[data-view="support"]').click()
        await expect(operator.locator('#ticket-list')).to_contain_text(subject)
        await page.get_by_role('button', name=re.compile('^Privacy & service information')).click()
        await expect(page.get_by_text(re.compile('Location is requested only when you choose'))).to_be_visible()
        privacy = await context.request.get(base + '/privacy')
        deletion = await context.request.get(base + '/account-deletion')
        assert privacy.ok and deletion.ok
        print('PASS: app support request reaches operations; privacy and account-deletion information are available', flush=True)

        await page.get_by_role('button', name='Sign out', exact=True).click()
        await expect(page.get_by_role('button', name=re.compile('Sign in')).first).to_be_visible()
        await select_tab(page, 'Account')
        assert customer['email'] not in await page.locator('body').inner_text(), 'Private account details remained after sign-out.'
        await page.get_by_role('button', name='Sign in or create an account', exact=True).click()
        await page.get_by_label('Email address', exact=True).fill(customer['email'])
        await page.get_by_label('Password', exact=True).fill(customer['password'])
        await page.get_by_role('button', name='Sign in', exact=True).last.click()
        await expect(page.get_by_role('button', name='Notifications and account', exact=True)).to_be_visible()
        await select_tab(page, 'Account')
        await page.get_by_role('button', name=re.compile('^Delete account')).click()
        await page.get_by_label('Confirm your password', exact=True).fill(customer['password'])
        await page.get_by_role('checkbox', name=re.compile('permanently deletes my account')).click()
        await page.get_by_role('button', name='Delete my account permanently', exact=True).click()
        await expect(page.get_by_role('button', name=re.compile('Sign in')).first).to_be_visible()
        await request(context.request, base, 'GET', '/v1/me', token=customer_token, expected=401)
        await request(context.request, base, 'POST', '/v1/auth/login', body={'email': customer['email'], 'password': customer['password']}, expected=401)
        print('PASS: sign-out clears private UI; real login works; in-app deletion revokes account access', flush=True)

        await operator.locator('[data-view="stations"]').click()
        await card.get_by_role('button', name='Edit location →', exact=True).click()
        await operator.locator('#station-verified').uncheck()
        await operator.locator('#station-save').click()
        await expect(operator.locator('#station-dialog')).to_be_hidden()
        await operator.set_viewport_size({'width': 390, 'height': 844})
        await no_overflow(operator, 'operator mobile')
        await screenshot(operator, output, 'operator-mobile-390')
        assert await operator.evaluate('localStorage.length') == 0 and await operator.evaluate('sessionStorage.length') == 0
        await operator.locator('#logout').click()
        await expect(operator.locator('#login-view')).to_be_visible()
        assert not js_errors, js_errors
        await browser.close()
    print('PASS: real app/operator acceptance complete. External browsing was blocked; no calls, messages or checkout were opened.', flush=True)
    print('Screenshots: ' + str(output), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:4100')
    parser.add_argument('--app-path', default='/app/')
    parser.add_argument('--credentials', type=Path, required=True)
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    parser.add_argument('--output', type=Path, default=Path('/tmp/evpower-app-browser'))
    asyncio.run(main(parser.parse_args()))
