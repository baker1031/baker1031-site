#!/usr/bin/env python3
"""Baker 1031 site — CI build (runs on Netlify).

Pipeline:
  1. Fetch "Master Listings Sheet" from Google Sheets as xlsx
     (SHEET_ID env var; falls back to data/fallback-master-listings.xlsx).
  2. Generate 63+ offering pages, 85+ sponsor pages, both directories,
     and the DST sector chart from the workbook.
  3. Inject the shared nav/footer partials into every page.
  4. Emit the complete site to dist/ (+ shared assets).

Local test:  python3 ci_build.py          (uses fallback xlsx if no network)
Netlify:     see netlify.toml
"""
import io, json, os, re, shutil, sys, unicodedata, urllib.request

import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
SHEET_ID = os.environ.get('SHEET_ID', '1vTqb5YX8pFjZxToGd2pJ_ncPbny2PXpW5gXx-7IlyZg')

# ---------------------------------------------------------------- fetch
def load_workbook():
    url = 'https://docs.google.com/spreadsheets/d/%s/export?format=xlsx' % SHEET_ID
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'baker1031-ci'})
        with urllib.request.urlopen(req, timeout=60) as r:
            blob = r.read()
        if not blob[:2] == b'PK':
            raise RuntimeError('not an xlsx (sheet not link-viewable?)')
        print('fetched live sheet: %d bytes' % len(blob))
        return openpyxl.load_workbook(io.BytesIO(blob), data_only=True)
    except Exception as e:
        print('WARN: live sheet fetch failed (%s); using fallback snapshot' % e)
        return openpyxl.load_workbook(os.path.join(ROOT, 'data', 'fallback-master-listings.xlsx'), data_only=True)

WB = load_workbook()

def sheet_dicts(name):
    ws = WB[name]
    hdr = [str(c.value).strip() if c.value is not None else '' for c in ws[1]]
    out = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not any(v not in (None, '') for v in r):
            continue
        out.append({hdr[i]: r[i] for i in range(len(hdr)) if hdr[i]})
    return out

LIST = sheet_dicts('Master Listings')
TRACK = sheet_dicts('Sponsor Trackrecord')
DOCS = sheet_dicts('Documents')
SPON = sheet_dicts('Sponsor Connection')
BM = sheet_dicts('Benchmarks')
print('rows: listings=%d track=%d docs=%d sponsors=%d benchmarks=%d' % (len(LIST), len(TRACK), len(DOCS), len(SPON), len(BM)))

# ---------------------------------------------------------------- helpers
def slugify(x):
    x = unicodedata.normalize('NFKD', str(x)).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', x.lower()).strip('-')

def s(v):
    if v is None: return ''
    if isinstance(v, float) and v == int(v) and abs(v) >= 1000:
        return '{:,.0f}'.format(v)
    return str(v).strip()

def pct(v, dp=2):
    if v in (None, ''): return ''
    if isinstance(v, (int, float)):
        n = v * 100 if abs(v) <= 1.5 else v
        return ('{:.' + str(dp) + 'f}%').format(n)
    return str(v).strip()

def money(v):
    if v in (None, ''): return ''
    if isinstance(v, (int, float)):
        return '${:,.0f}'.format(v)
    return str(v).strip()

def yrs(v):
    if v in (None, ''): return ''
    if isinstance(v, (int, float)):
        return '{:.2f} Yrs'.format(v)
    return str(v).strip()

def mult(v):
    if v in (None, ''): return ''
    if isinstance(v, (int, float)):
        return '{:.2f}x'.format(v)
    return str(v).strip()

# ---------------------------------------------------------------- maps
off_slug = {}
for row in LIST:
    u = s(row.get('URL'))
    off_slug[row['Investment Name']] = (u.split('/')[-1] if u else slugify(row['Investment Name'])) + '.html'

spon_slug = {}
for row in LIST:
    su = s(row.get('Sponsor URL'))
    if su:
        spon_slug[s(row['Sponsor'])] = 'sponsor-' + su.split('/')[-1] + '.html'
for sp in SPON:
    nm = s(sp['Investment Firm'])
    spon_slug.setdefault(nm, 'sponsor-' + slugify(nm) + '.html')

docs_by_inv = {}
for d in DOCS:
    docs_by_inv.setdefault(s(d['Investment Name']), []).append(d)
track_by_sp = {}
for t in TRACK:
    track_by_sp.setdefault(s(t['Sponsor']), []).append(t)
spon_by_name = {s(x['Investment Firm']): x for x in SPON}

FOOTNOTES = [
    'Average Yield is the simple average of the sponsor’s projected annual distribution rates as presented in the Private Placement Memorandum. Projections are not guaranteed and actual distributions may be lower.',
    'Estimated Tax-Adjusted Yield reflects the projected impact of depreciation and amortization deductions at an assumed combined federal and state tax rate. Individual tax outcomes vary — consult your CPA regarding your specific situation.',
    'Cap Rate Equivalent is a Baker 1031 Investments calculation intended to allow comparison with direct property ownership; it is not a sponsor-reported figure and does not represent a rate of return.',
    'Benchmarks compare this offering’s projected figures against sector medians computed across current offerings tracked by Baker 1031 Investments as of the last-updated date shown. Benchmark data is internal, unaudited, and subject to change.',
]

# ---------------------------------------------------------------- generation
otpl = open(os.path.join(ROOT, 'templates', 'offering-template.html')).read()
stpl = open(os.path.join(ROOT, 'templates', 'sponsor-template.html')).read()

generated = {}  # filename -> html

def build_offering(row):
    name = s(row['Investment Name'])
    slug = off_slug[name]
    yields = {}
    for y in ['Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10']:
        if row.get(y) not in (None, ''):
            yields[y] = pct(row.get(y))
    docs = []
    for d in docs_by_inv.get(name, []):
        gated = s(d.get('Gated?')).lower() in ('yes','true','y','1','gated')
        f = s(d.get('File'))
        docs.append({'label': s(d['Label']) + (' (by request)' if gated and not f else ''),
                     'url': f if (f and f.startswith('http')) else '#'})
    if not docs:
        docs = [{'label': 'Offering Documents Available By Request', 'url': '#'}]
    bms = []
    for label, a, b, c in [('Avg. Income','BM: Avg. Income - Deal','BM: Avg. Income - MKT','BM: Avg. Income - Interpret'),
                           ('Growth','BM: Growth - Deal','BM: Growth- MKT','BM: Growth - Interpret'),
                           ('Peak','BM: Peak - Deal','BM: Peak- MKT','BM: Peak - Interpret')]:
        if row.get(a) not in (None, ''):
            bms.append({'metric': label, 'deal': pct(row.get(a)), 'market': pct(row.get(b)), 'interpret': s(row.get(c))})
    sp = s(row['Sponsor'])
    spr = spon_by_name.get(sp, {})
    d = {
      'investmentName': name, 'sponsor': sp,
      'structure': s(row.get('Structure')), 'status': s(row.get('Status')),
      'totalOffering': money(row.get('Total Offering')), 'equity': money(row.get('Equity')),
      'debt': money(row.get('Debt')), 'inPlaceLtv': s(row.get('In-Place LTV')) or pct(row.get('In-Place LTV')),
      'availableEquity': money(row.get('Available Equity')),
      'lastUpdated': s(row.get('Last Updated')).split(' ')[0],
      'availablePercentage': pct(row.get('Available Percentage')),
      'propertyType': s(row.get('Property Type')), 'location': s(row.get('Location')),
      'locationUse': s(row.get('Location (Use)')), 'totalLoad': pct(row.get('Total Load')),
      'strategy': s(row.get('Strategy')), 'exchange721Exit': s(row.get('721 Exchange Exit')),
      'estimatedHoldPeriod': s(row.get('Estimated Hold Period')),
      'description': s(row.get('Description')),
      'highlights': [s(row.get('Highlight %d' % i)) for i in range(1, 6) if s(row.get('Highlight %d' % i))],
      'pros': s(row.get('Pros')), 'cons': s(row.get('Cons')), 'insights': s(row.get('Insights')),
      'yields': yields, 'averageYield': pct(row.get('Average Yield')),
      'taxAdjYield': s(row.get('Tax-Adj. Yield')) or pct(row.get('Tax-Adj. Yield')),
      'capRateEquivalent': pct(row.get('Cap Rate Equivalent')),
      'lender': s(row.get('Lender')), 'interestRate': s(row.get('Interest Rate')) or pct(row.get('Interest Rate')),
      'loanTerm': s(row.get('Loan Term')), 'ioPeriod': s(row.get('I/O Period')),
      'amortization': s(row.get('Amortization')), 'y1Dscr': s(row.get('Y1 DSCR')),
      'propertyAddress': s(row.get('Property Address')),
      'minimumInvestment': money(row.get('Minimum Investment')),
      'photoLinkUse': s(row.get('Photo Link Use')),
      'taxAdjustedYieldUse': pct(row.get('Tax Adjusted Yield (Use)')),
      'taxAdjLabel': s(row.get('Tax Adj Label')) or 'Est. Tax-Adjusted Yield',
      'ddLabel': s(row.get('DD Label')), 'url': slug.replace('.html',''),
      'sponsorUrl': spon_slug.get(sp, '#'),
      'sponsorButtonText': s(row.get('Sponsor Button Text')) or ('Learn More About ' + sp),
      'sponsorFounded': s(spr.get('Year Founded')),
      'sponsorDescription': s(spr.get('Description / Overview')) or s(row.get('Sponsor Description')),
      'sponsorAum': s(spr.get('AUM')) or s(row.get('Sponsor AUM')),
      'fullCycleCount': s(spr.get('Full-Cycle Deals')) or s(row.get('Full-Cycle Count')),
      'sponsorAar': pct(spr.get('Average Annual Return')) or pct(row.get('Sponsor AAR')),
      'sponsorAem': mult(spr.get('Average Equity Multiple')) or s(row.get('Sponsor AEM')),
      'sponsorHold': yrs(spr.get('Average Hold Period')) or s(row.get('Sponsor Hold')),
      'sponsorSuccess': pct(spr.get('Success Rate')) or pct(row.get('Sponsor Success')),
      'sponsorImage': s(spr.get('Logo')) or s(row.get('Sponsor Image')),
      'documents': docs, 'benchmarks': bms, 'footnotes': FOOTNOTES,
    }
    d = {k: v for k, v in d.items() if v not in (None, '', [], {})}
    page = otpl
    page = re.sub(r'<title>.*?</title>', '<title>' + name.replace('&','&amp;') + ' | Baker 1031 Investments</title>', page, flags=re.S)
    page = re.sub(r'<script type="application/json" id="offering-data">\n.*?\n</script>',
                  lambda _m: '<script type="application/json" id="offering-data">\n' + json.dumps(d, indent=1, ensure_ascii=False) + '\n</script>',
                  page, flags=re.S)
    page = page.replace('>AEI Healthcare Portfolio VII DST<', '>' + name + '<')
    generated[slug] = page
    return d

dir_rows = []
for row in LIST:
    d = build_offering(row)
    dir_rows.append({
      'name': d.get('investmentName',''), 'url': off_slug[d['investmentName']],
      'sponsor': d.get('sponsor',''), 'propertyType': d.get('propertyType',''),
      'location': d.get('locationUse') or d.get('location',''),
      'ltv': d.get('inPlaceLtv','').replace(' LTV',''),
      'minimum': d.get('minimumInvestment',''),
      'y1Yield': (d.get('yields') or {}).get('Y1',''),
      'avgYield': d.get('averageYield',''), 'status': d.get('status',''),
      'availablePct': d.get('availablePercentage',''), 'photo': d.get('photoLinkUse',''),
      'description': (s(row.get('List Description')) or d.get('description',''))[:400],
    })

sp_dir = []
for sp in SPON:
    nm = s(sp['Investment Firm'])
    slug = spon_slug[nm]
    strategies = [s(sp.get('Key Strategy / Advantage %d' % i)) for i in range(1, 6)]
    strategies = [x for x in strategies if x]
    track = [{'investment': s(t.get('Investment')), 'location': s(t.get('Location')),
              'assetClass': s(t.get('Asset Class')) or '—',
              'holdPeriod': ('{:.2f}'.format(t['Hold Period']) if isinstance(t.get('Hold Period'), (int, float)) else s(t.get('Hold Period'))),
              'equityMultiple': mult(t.get('Equity Multiple')),
              'annualReturn': pct(t.get('Annual Return'))} for t in track_by_sp.get(nm, [])]
    offers = [{'name': r['name'],
               'sub': ' · '.join(x for x in [r['propertyType'], r['location'],
                        (r['ltv'] + ' LTV' if r['ltv'] else ''), (r['minimum'] + ' minimum' if r['minimum'] else '')] if x),
               'url': r['url']} for r in dir_rows if r['sponsor'] == nm]
    d = {'name': nm, 'founded': s(sp.get('Year Founded')), 'aum': s(sp.get('AUM')),
         'hq': s(sp.get('Headquarters (City, State)')), 'website': s(sp.get('Website')),
         'logo': s(sp.get('Logo')),
         'fullCycleDeals': s(sp.get('Full-Cycle Deals')) or (str(len(track)) if track else ''),
         'avgAnnualReturn': pct(sp.get('Average Annual Return')),
         'avgEquityMultiple': mult(sp.get('Average Equity Multiple')),
         'avgHoldPeriod': yrs(sp.get('Average Hold Period')),
         'successRate': pct(sp.get('Success Rate')),
         'description': s(sp.get('Description / Overview')),
         'strategies': strategies, 'currentOfferings': offers, 'fullTrackRecord': track}
    d = {k: v for k, v in d.items() if v not in (None, '', [])}
    page = stpl
    page = re.sub(r'<title>.*?</title>', '<title>' + nm.replace('&','&amp;') + ' | Baker 1031 Investments</title>', page, flags=re.S)
    page = re.sub(r'<script type="application/json" id="sponsor-data">\n.*?\n</script>',
                  lambda _m: '<script type="application/json" id="sponsor-data">\n' + json.dumps(d, indent=1, ensure_ascii=False) + '\n</script>',
                  page, flags=re.S)
    page = page.replace('>AEI Capital Corporation<', '>' + nm + '<')
    generated[slug] = page
    sp_dir.append({'name': nm, 'url': slug, 'founded': d.get('founded',''), 'aum': d.get('aum',''),
                   'hq': d.get('hq',''), 'website': d.get('website',''), 'logo': d.get('logo',''),
                   'fullCycleDeals': d.get('fullCycleDeals','—'),
                   'avgAnnualReturn': d.get('avgAnnualReturn','—'),
                   'avgEquityMultiple': d.get('avgEquityMultiple','—'),
                   'avgHoldPeriod': d.get('avgHoldPeriod','—'),
                   'successRate': d.get('successRate','—'),
                   'description': d.get('description','')[:500]})

print('generated: %d offering + %d sponsor pages' % (len(dir_rows), len(sp_dir)))

# ---------------------------------------------------------------- assemble
nav = open(os.path.join(ROOT, 'src', 'partials', 'nav.html')).read()
footer = open(os.path.join(ROOT, 'src', 'partials', 'footer.html')).read()

def inject(html_text):
    return html_text.replace('<!-- @@NAV@@ -->', nav).replace('<!-- @@FOOTER@@ -->', footer)

shutil.rmtree(DIST, ignore_errors=True)
os.makedirs(DIST)
count = 0
import glob as _glob
for d in ('pages', 'pages-legacy'):
    for f in _glob.glob(os.path.join(ROOT, 'src', d, '*.html')):
        html_text = open(f).read()
        base = os.path.basename(f)
        if base == 'investments.html':
            html_text = re.sub(r'<script type="application/json" id="directory-data">\n.*?\n</script>',
                               lambda _m: '<script type="application/json" id="directory-data">\n' + json.dumps(dir_rows, indent=1, ensure_ascii=False) + '\n</script>',
                               html_text, flags=re.S)
        if base == 'delaware-statutory-trusts.html':
            bm_map = {s(b['Property Type']): b for b in BM}
            picks = ['Marina', 'Healthcare', 'Net Lease', 'Multifamily', 'Self-Storage', 'Office']
            vals = []
            for key in picks:
                b = bm_map.get(key)
                if b and isinstance(b.get('Average Yield'), (int, float)) and b['Average Yield']:
                    vals.append((key, b['Average Yield'] * 100))
            vals.sort(key=lambda x: -x[1])
            xs = [60, 141, 222, 303, 384, 465]
            bars, labels = [], []
            for i, (label, v) in enumerate(vals[:6]):
                hpx = v * 16.875
                bars.append('          <rect x="%d" y="%.1f" width="52" height="%.1f"><title>%s — %.2f%%</title></rect>' % (xs[i], 155 - hpx, hpx, label, v))
                labels.append('<text x="%d" y="172">%s</text>' % (xs[i] + 26, label))
            bar_block = '<g fill="#243856">\n' + '\n'.join(bars) + '\n        </g>'
            lbl_block = '<g fill="#777" font-size="10" text-anchor="middle">\n          ' + ''.join(labels) + '\n        </g>'
            html_text = re.sub(r'<g fill="#243856">\n.*?</g>', lambda _m: bar_block, html_text, count=1, flags=re.S)
            html_text = re.sub(r'<g fill="#777" font-size="10" text-anchor="middle">\n.*?</g>', lambda _m: lbl_block, html_text, count=1, flags=re.S)
        if base == 'sponsors.html':
            html_text = re.sub(r'<script type="application/json" id="directory-data">\n.*?\n</script>',
                               lambda _m: '<script type="application/json" id="directory-data">\n' + json.dumps(sp_dir, indent=1, ensure_ascii=False) + '\n</script>',
                               html_text, flags=re.S)
        open(os.path.join(DIST, base), 'w').write(inject(html_text))
        count += 1
for base, html_text in generated.items():
    open(os.path.join(DIST, base), 'w').write(inject(html_text))
    count += 1

shutil.copytree(os.path.join(ROOT, 'src', 'assets'), os.path.join(DIST, 'assets'))
shutil.copy(os.path.join(DIST, 'baker1031.html'), os.path.join(DIST, 'index.html'))
print('built %d pages -> dist/' % (count + 1))
