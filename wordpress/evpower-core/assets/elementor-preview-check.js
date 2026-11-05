(() => {
    'use strict';
    const config = window.evpowerPreviewCheck;
    if (!config) return;
    const locationLabel = value => {
        try { const u = new URL(value, location.href); return u.origin + u.pathname; }
        catch (_) { return 'unavailable'; }
    };
    const base = () => ({...config.base, 'Admin origin': location.origin, 'WordPress address': locationLabel(config.siteUrl), 'Site address': locationLabel(config.homeUrl)});
    const inspect = (doc, report) => {
        report['Server preview marker'] = doc.querySelector('meta[name="evpower-layout-preview"]')?.content || 'missing';
        report['Native preview state'] = doc.querySelector('meta[name="evpower-preview-state"]')?.content || 'unknown';
        report['Delivered document IDs'] = [...doc.querySelectorAll('.elementor[data-elementor-id]')].map(el => el.getAttribute('data-elementor-id')).filter((id, i, all) => all.indexOf(id) === i).slice(0, 20).join(', ') || 'none';
        report['Requested editing area'] = doc.querySelector('.elementor[data-elementor-id="' + config.documentId + '"]') ? 'found' : 'missing';
    };
    const serialize = report => Object.entries(report).map(([key, value]) => key + ': ' + value).join('\n');
    const copy = async (report, button, output) => {
        const text = serialize(report);
        if (output) { output.value = text; output.focus(); output.select(); }
        try { await navigator.clipboard.writeText(text); button.textContent = 'Report copied'; }
        catch (_) {
            if (!output) {
                output = document.createElement('textarea'); output.readOnly = true; output.value = text;
                Object.assign(output.style, {position:'fixed',right:'16px',bottom:'64px',width:'min(600px,90vw)',height:'320px',zIndex:'2147483647',background:'#fff',color:'#111'});
                document.body.appendChild(output); output.focus(); output.select();
            }
            button.textContent = 'Select and copy the report';
        }
    };
    const start = async () => {
        if (config.mode === 'editor') {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Copy Evpower editor report';
            Object.assign(button.style, {position:'fixed',right:'16px',bottom:'16px',zIndex:'2147483647',padding:'12px 16px',border:'1px solid #aaa',borderRadius:'6px',background:'#fff',color:'#111',cursor:'pointer'});
            document.body.appendChild(button);
            button.addEventListener('click', () => {
                const report = base();
                const native = window.elementor?.config?.document || window.elementor?.config?.initial_document;
                report['Editor document ID'] = native?.id || 'unavailable'; report['Editor document type'] = native?.type || 'unavailable';
                const frame = document.getElementById('elementor-preview-iframe');
                report['Iframe location'] = frame ? locationLabel(frame.src) : 'missing';
                report['Direct preview route requested'] = frame && new URL(frame.src, location.href).searchParams.has('evpower-layout-preview') ? 'yes' : 'no';
                try {
                    if (frame?.contentDocument) inspect(frame.contentDocument, report);
                    else report['Iframe access'] = 'unavailable or different origin';
                } catch (_) { report['Iframe access'] = 'different origin'; }
                copy(report, button);
            });
            return;
        }
        let report = base();
        const output = document.getElementById('evpower-preview-report');
        const status = document.getElementById('evpower-preview-status');
        document.getElementById('evpower-copy-preview-report').addEventListener('click', e => copy(report, e.currentTarget, output));
        try {
            if (!config.previewUrl) throw new Error('Elementor or layout editing is unavailable.');
            const target = new URL(config.previewUrl, location.href);
            report['Preview location'] = locationLabel(target.href);
            if (target.origin !== location.origin) throw new Error('The preview and admin use different origins. Check the WordPress address.');
            const response = await fetch(target.href, {credentials:'same-origin',cache:'no-store',redirect:'follow'});
            report['HTTP status'] = response.status; report['Response location'] = locationLabel(response.url);
            report['WordPress preview authorization'] = response.headers.get('X-Evpower-Preview-Request') || 'not recognized';
            inspect(new DOMParser().parseFromString(await response.text(), 'text/html'), report);
            const ready = response.ok && report['Server preview marker'] === config.base['Evpower Core'] && report['Native preview state'] === 'active' && report['Requested editing area'] === 'found' && report['Document editable'] === 'yes';
            status.className = 'notice inline ' + (ready ? 'notice-success' : 'notice-error');
            status.querySelector('p').textContent = ready ? 'Preview ready: WordPress delivered the requested editing area. Use Open editor with diagnostics to check the editor itself.' : 'The preview check found a problem. Copy the report so the failing step can be identified.';
        } catch (error) {
            report['Check result'] = error.message; status.className = 'notice notice-error inline';
            status.querySelector('p').textContent = 'The preview could not be checked. Copy the report below.';
        }
        output.value = serialize(report);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
