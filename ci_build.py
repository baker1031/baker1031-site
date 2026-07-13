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
import datetime
import html as html_lib
import io, json, os, re, shutil, sys, unicodedata, urllib.request

import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
SHEET_ID = os.environ.get('SHEET_ID', '1vTqb5YX8pFjZxToGd2pJ_ncPbny2PXpW5gXx-7IlyZg')
GA4_MEASUREMENT_ID = os.environ.get('GA4_MEASUREMENT_ID', 'G-P29LR49RL8')
BASE_URL = os.environ.get('BASE_URL', 'https://baker1031-project3-site.netlify.app').rstrip('/')
BUILD_DATE = os.environ.get('BUILD_DATE', datetime.date.today().isoformat())

# These files remain available as authoring/source material but must never be
# emitted as public, indexable pages.
SKIP_SOURCE_PAGES = {'article-template.html', 'insight-1031-exchange-guide.html'}
NOINDEX_PAGES = {'article-template.html', 'insight-1031-exchange-guide.html',
                 'employee.html', 'account.html', '404.html', 'baker1031.html'}

APPROVED_DISCLOSURE_LINK = (
    'For entity and registration details, see the '
    '<a href="disclosures.html">Baker 1031 disclosures</a> and the applicable '
    'Private Placement Memorandum.'
)

PAGE_DESCRIPTIONS = {
    'index.html': 'Baker 1031 Investments helps accredited investors evaluate 1031 exchanges, DST replacement property, 721 UPREIT strategies, Opportunity Zones, mineral interests, and REITs.',
    'baker1031.html': 'Baker 1031 Investments provides 1031 exchange education, DST replacement-property research, current offerings, sponsor data, and investor resources.',
    'about.html': 'Learn how Baker 1031 Investments evaluates 1031 replacement-property strategies, works with accredited investors, and coordinates offerings through Aurora Securities.',
    'investments.html': 'Browse current Delaware Statutory Trust and 1031 exchange replacement-property offerings, with property details, sponsor information, projected income, and risks.',
    'sponsors.html': 'Research DST and 1031 exchange sponsors, current offerings, sponsor facts, and realized full-cycle track-record data compiled by Baker 1031 Investments.',
    'insights.html': 'Explore Baker 1031 Investments research on 1031 exchanges, DSTs, 721 UPREITs, Opportunity Zones, mineral and royalty interests, REITs, and real-estate tax planning.',
    'delaware-statutory-trusts.html': 'Learn how Delaware Statutory Trusts can serve as 1031 exchange replacement property, including structure, benefits, risks, financing, income, and due diligence.',
    '1031-exchange-guide.html': 'A practical guide to 1031 exchange rules, like-kind property, the 45-day identification period, the 180-day exchange period, boot, and replacement strategies.',
    '721-exchange-guide.html': 'Understand 721 UPREIT exchanges, including how DST interests or real property may be contributed for operating-partnership units and the trade-offs involved.',
    'opportunity-zones-guide.html': 'Understand Qualified Opportunity Zone funds, capital-gain deferral, the ten-year holding period, tax treatment, suitability, and investment risks.',
    'mineral-rights-1031-guide.html': 'Learn how qualifying mineral and royalty interests may fit into a 1031 exchange, including perpetual-interest rules, income, depletion, and risk.',
    'reits-guide.html': 'Compare public, non-traded, and private REITs, including liquidity, distributions, valuation, fees, risks, and connections to 721 UPREIT strategies.',
    'methodology.html': 'Review how Baker 1031 compiles sponsor, offering, benchmark, and full-cycle data, including definitions, limitations, and sponsor-reported figures.',
    'contact.html': 'Contact the Baker 1031 Investments desk about current offerings, 1031 replacement-property research, sponsor due diligence, or advisor coordination.',
    'request-access.html': 'Request access to Baker 1031 Investments resources and current offerings for accredited investors, subject to suitability and required disclosures.',
    'faq.html': 'Answers to common questions about 1031 exchanges, DSTs, 721 UPREITs, Opportunity Zones, REITs, mineral interests, eligibility, fees, and risks.',
}

HUB_FILES = {
    '1031-exchange-guide.html', 'delaware-statutory-trusts.html',
    '721-exchange-guide.html', 'opportunity-zones-guide.html',
    'mineral-rights-1031-guide.html', 'reits-guide.html', 'strategies.html',
    'investments.html', 'sponsors.html', 'insights.html', 'faq.html',
}

AUTHORITY_SOURCES = [
    'https://www.irs.gov/businesses/small-businesses-self-employed/like-kind-exchanges-real-estate-tax-tips',
    'https://www.irs.gov/forms-pubs/about-form-8824',
    'https://www.investor.gov/',
    'https://www.finra.org/',
    'https://brokercheck.finra.org/individual/summary/7537416',
]

STATE_TAX_AUTHORITIES = json.load(open(os.path.join(ROOT, 'data', 'state-tax-authorities.json')))
STATE_AUTHORITY_URLS = {item['url'] for item in STATE_TAX_AUTHORITIES.values()}
AUTHOR_NAME = 'Gerald F. "Jerry" Baker, III'
REVIEWER = {
    '@type': 'Person',
    'name': 'Lori Kamen',
    'jobTitle': 'Chief Compliance Officer, Aurora Securities, Inc.',
    'identifier': {'@type': 'PropertyValue', 'propertyID': 'FINRA CRD', 'value': '2805591'},
    'sameAs': ['https://brokercheck.finra.org/individual/summary/2805591'],
}

SEO_META = {}

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

def money_compact(v):
    # AUM-style compact currency: 2000000000 -> "$2.0B", 440000000 -> "$440M".
    if v in (None, ''): return ''
    if isinstance(v, (int, float)):
        n = float(v)
        if n >= 1e9:
            return '${:.1f}B'.format(n / 1e9)
        if n >= 1e6:
            return '${:.0f}M'.format(n / 1e6)
        if n >= 1e3:
            return '${:,.0f}'.format(n)
        return '${:,.0f}'.format(n)
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

def html_json(value):
    """Make JSON safe inside an HTML script element."""
    return json.dumps(value, indent=1, ensure_ascii=False).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')

def text_from_html(raw):
    raw = re.sub(r'<(style|script|noscript)[^>]*>.*?</\1>', ' ', raw, flags=re.S | re.I)
    raw = re.sub(r'<[^>]+>', ' ', raw)
    raw = html_lib.unescape(raw)
    return re.sub(r'\s+', ' ', raw).strip()

def page_title(raw, fallback='Baker 1031 Investments'):
    m = re.search(r'<title[^>]*>(.*?)</title>', raw, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', html_lib.unescape(re.sub(r'<[^>]+>', ' ', m.group(1)))).strip() if m else fallback

def trim_description(value, limit=160):
    value = re.sub(r'\s+', ' ', html_lib.unescape(str(value))).strip()
    if len(value) <= limit:
        return value
    return value[:limit - 1].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'

def page_description(base, raw, meta=None):
    if meta and meta.get('description'):
        return trim_description(meta['description'])
    if base in PAGE_DESCRIPTIONS:
        return trim_description(PAGE_DESCRIPTIONS[base])
    title = page_title(raw, base.replace('.html', '').replace('-', ' ').title())
    paragraphs = re.findall(r'<p(?:\s[^>]*)?>(.*?)</p>', raw, flags=re.S | re.I)
    body = ''
    for p in paragraphs:
        candidate = text_from_html(p)
        if len(candidate) >= 40:
            body = candidate
            break
    if not body:
        m = re.search(r'<h1[^>]*>(.*?)</h1>', raw, flags=re.S | re.I)
        body = text_from_html(m.group(1)) if m else title
    body = body.rstrip(' .')
    return trim_description(title + ' — ' + body + '. Baker 1031 Investments provides educational and investment-research resources for accredited investors.')

def extract_citations(raw):
    urls = re.findall(r"href=[\"'](https?://[^\"']+)", raw, flags=re.I)
    selected = []
    for url in urls:
        if (url in STATE_AUTHORITY_URLS or re.search(r'(irs\.gov|investor\.gov|sec\.gov|finra\.org|brokercheck\.finra\.org|ftb\.ca\.gov|tax\.)', url, re.I)) and url not in selected:
            selected.append(url)
    return selected[:12]

def state_slug_for_page(base):
    stem = base[:-5] if base.endswith('.html') else base
    prefix = '1031-exchange-'
    if not stem.startswith(prefix):
        return None
    suffix = stem[len(prefix):]
    for slug in sorted(STATE_TAX_AUTHORITIES, key=len, reverse=True):
        if suffix == slug or suffix.startswith(slug + '-'):
            return slug
    return None

def page_citations(base, raw):
    citations = extract_citations(raw)
    state_slug = state_slug_for_page(base)
    if state_slug:
        authority_url = STATE_TAX_AUTHORITIES[state_slug]['url']
        citations = [authority_url] + [url for url in citations if url != authority_url]
    elif (base in HUB_FILES or base not in NOINDEX_PAGES) and not citations:
        citations = AUTHORITY_SOURCES[:]
    return citations[:12]

def state_authority_note(base):
    state_slug = state_slug_for_page(base)
    if not state_slug:
        return ''
    authority = STATE_TAX_AUTHORITIES[state_slug]
    name = html_lib.escape(authority['name'])
    url = html_lib.escape(authority['url'], quote=True)
    return ('<p class="b1031-state-source">State tax source: '
            '<a href="%s" target="_blank" rel="noopener noreferrer">Official %s</a>. '
            'State rules can change; confirm current treatment with the agency and your tax adviser.</p>' % (url, name))

def normalize_editorial_identity(raw):
    raw = raw.replace('Baker 1031 Research is the editorial desk at Baker 1031 Investments',
                      'Gerald F. &quot;Jerry&quot; Baker, III leads the editorial work at Baker 1031 Investments')
    raw = raw.replace('Source: Baker 1031 Research.', 'Source: Gerald F. &quot;Jerry&quot; Baker, III.')
    raw = raw.replace('Baker 1031 Research', AUTHOR_NAME)
    raw = raw.replace(
        'President &amp; CCO, Aurora Securities, Inc. (FINRA Series 4 / 7 / 24 / 53 / 63 / 66), the supervising registered principal.',
        'Chief Compliance Officer, Aurora Securities, Inc. (FINRA CRD #2805591).')
    return raw.replace(
        'President &amp; CCO, Aurora Securities',
        'Chief Compliance Officer, Aurora Securities (FINRA CRD #2805591)')

def seo_jsonld(base, title, description, canonical, raw):
    author = {
        '@type': 'Person',
        'name': AUTHOR_NAME,
        'alternateName': 'Jerry Baker',
        'jobTitle': 'Founder & Managing Principal, Baker 1031 Investments',
        'url': BASE_URL + '/jerry-baker-bio.html',
        'sameAs': ['https://brokercheck.finra.org/individual/summary/7537416'],
    }
    publisher = {
        '@type': 'Organization',
        'name': 'Baker 1031 Investments, LLC',
        'url': BASE_URL + '/',
        'logo': {'@type': 'ImageObject', 'url': BASE_URL + '/assets/logo.png'},
    }
    citations = page_citations(base, raw)
    review_text = text_from_html(raw)
    review_match = re.search(r'Reviewed by\s+(.+?)\s+—\s+(.+?)\.\s+Last reviewed\s+([A-Za-z]+\s+\d{4})', review_text, flags=re.I)
    reviewer = REVIEWER if review_match or base not in NOINDEX_PAGES else None
    if base == 'jerry-baker-bio.html':
        data = {
            '@context': 'https://schema.org', '@type': ['ProfilePage', 'WebPage'],
            'url': canonical, 'name': title, 'description': description,
            'mainEntity': author, 'publisher': publisher,
        }
    elif base not in NOINDEX_PAGES and (base.endswith('.html')):
        data = {
            '@context': 'https://schema.org',
            '@type': 'Article' if base not in HUB_FILES and base not in SEO_META and base not in ('contact.html', 'request-access.html') else 'WebPage',
            'url': canonical, 'headline': title, 'name': title,
            'description': description, 'publisher': publisher,
        }
        if data['@type'] == 'Article':
            data['author'] = author
            if reviewer:
                data['reviewedBy'] = reviewer
                if review_match:
                    data['dateModified'] = review_match.group(3)
        if citations:
            data['citation'] = citations
    else:
        data = {'@context': 'https://schema.org', '@type': 'WebPage', 'url': canonical, 'name': title, 'description': description, 'publisher': publisher}
    return html_json(data)

def remove_seo_tags(raw):
    raw = re.sub(r"\s*<meta\b[^>]*(?:name|property)=[\"'](?:description|robots|og:[^\"']+|twitter:[^\"']+)[\"'][^>]*>", '', raw, flags=re.I)
    raw = re.sub(r"\s*<link\b[^>]*rel=[\"']canonical[\"'][^>]*>", '', raw, flags=re.I)
    raw = re.sub(r"\s*<script\b[^>]*type=[\"']application/ld\+json[\"'][^>]*>.*?</script>", '', raw, flags=re.S | re.I)
    return raw

# ---------------------------------------------------------------- maps
def urlseg(u):
    """Last path segment of a sheet URL value, sanitized into a clean slug."""
    seg = u.rstrip('/').split('/')[-1]
    return slugify(seg.replace('&', ' and '))

off_slug = {}
for row in LIST:
    u = s(row.get('URL'))
    off_slug[row['Investment Name']] = (urlseg(u) if u else slugify(row['Investment Name'])) + '.html'

spon_slug = {}
for row in LIST:
    su = s(row.get('Sponsor URL'))
    if su:
        spon_slug[s(row['Sponsor'])] = 'sponsor-' + urlseg(su) + '.html'
for sp in SPON:
    nm = s(sp['Investment Firm'])
    spon_slug.setdefault(nm, 'sponsor-' + slugify(nm.replace('&', ' and ')) + '.html')

# Guard against sheet data errors: two sponsors mapped to the same URL slug
# (e.g. Resource Royalty's Sponsor URL mistakenly set to sponsors/exchangeright).
# The sponsor whose own name matches the slug keeps it; others fall back to their name.
_by_slug = {}
for _nm, _sl in spon_slug.items():
    _by_slug.setdefault(_sl, []).append(_nm)
for _sl, _nms in _by_slug.items():
    if len(_nms) > 1:
        for _nm in _nms:
            if slugify(_nm.replace('&', ' and ')) not in _sl:
                spon_slug[_nm] = 'sponsor-' + slugify(_nm.replace('&', ' and ')) + '.html'
                print('WARN: sponsor URL collision for %r on %s -> reassigned %s' % (_nm, _sl, spon_slug[_nm]))

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
      'sponsorAum': money_compact(spr.get('AUM')) or money_compact(row.get('Sponsor AUM')),
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
                  lambda _m: '<script type="application/json" id="offering-data">\n' + html_json(d) + '\n</script>',
                  page, flags=re.S)
    page = page.replace('>AEI Healthcare Portfolio VII DST<', '>' + name + '<')
    summary = ' '.join(x for x in [d.get('propertyType'), d.get('locationUse') or d.get('location'), d.get('status')] if x)
    SEO_META[slug] = {
        'title': name + ' | Baker 1031 Investments',
        'description': (name + ' — ' + (summary or '1031 exchange replacement-property offering') + '. Review property details, projected income, financing, sponsor information, and risks from Baker 1031 Investments.')[:300],
    }
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
    d = {'name': nm, 'founded': s(sp.get('Year Founded')), 'aum': money_compact(sp.get('AUM')),
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
                  lambda _m: '<script type="application/json" id="sponsor-data">\n' + html_json(d) + '\n</script>',
                  page, flags=re.S)
    page = page.replace('>AEI Capital Corporation<', '>' + nm + '<')
    SEO_META[slug] = {
        'title': nm + ' | Baker 1031 Investments',
        'description': (nm + ' — DST sponsor profile with current offerings, strategy information, sponsor facts, and full-cycle track-record data from Baker 1031 Investments.')[:300],
    }
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
GA4_TAG = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '%s');
</script>""" % (GA4_MEASUREMENT_ID, GA4_MEASUREMENT_ID)
ANALYTICS_SCRIPT = '<script src="assets/analytics.js" defer></script>'
ANALYTICS_EXCLUDE = {'employee.html'}
RELATED_HUBS_HTML = """<section class="b1031-related" aria-label="Explore Baker 1031 topics">
  <div class="b1031-related-inner">
    <div class="b1031-related-kicker">Explore the Baker 1031 research library</div>
    <div class="b1031-related-links">
      <a href="1031-exchange-guide.html">1031 Exchanges</a>
      <a href="delaware-statutory-trusts.html">DSTs</a>
      <a href="721-exchange-guide.html">721 / UPREITs</a>
      <a href="opportunity-zones-guide.html">Opportunity Zones</a>
      <a href="mineral-rights-1031-guide.html">Mineral &amp; Royalty Interests</a>
      <a href="reits-guide.html">REITs</a>
      <a href="investments.html">Current Offerings</a>
      <a href="sponsors.html">Sponsor Directory</a>
    </div>
  </div>
</section>"""

def seo_inject(html_text, base):
    html_text = normalize_editorial_identity(html_text)
    html_text = html_text.replace('[Placeholder regulatory disclosure — replace with verified entity names, CRD numbers, and registrations.]', APPROVED_DISCLOSURE_LINK)
    meta = SEO_META.get(base, {})
    title = meta.get('title') or page_title(html_text, base.replace('.html', '').replace('-', ' ').title())
    description = page_description(base, html_text, meta)
    canonical = BASE_URL + '/' if base in ('index.html', 'baker1031.html') else BASE_URL + '/' + base
    robots = 'noindex, nofollow' if base in NOINDEX_PAGES else 'index, follow'
    title_attr = html_lib.escape(title, quote=False)
    desc_attr = html_lib.escape(description, quote=True)
    canonical_attr = html_lib.escape(canonical, quote=True)
    markup = """<meta name="description" content="%s">
<meta name="robots" content="%s">
<link rel="canonical" href="%s">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Baker 1031 Investments">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:url" content="%s">
<meta property="og:image" content="%s/assets/logo.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="%s">
<meta name="twitter:description" content="%s">
<meta name="twitter:image" content="%s/assets/logo.png">
<link rel="stylesheet" href="assets/site-enhancements.css">""" % (
        desc_attr, robots, canonical_attr, title_attr, desc_attr, canonical_attr,
        BASE_URL, title_attr, desc_attr, BASE_URL)
    html_text = remove_seo_tags(html_text)
    html_text = re.sub(r'<title[^>]*>.*?</title>', '<title>' + title_attr + '</title>', html_text, count=1, flags=re.S | re.I)
    jsonld = '<script type="application/ld+json">' + seo_jsonld(base, title, description, canonical, html_text) + '</script>'
    if '</title>' in html_text.lower():
        html_text = re.sub(r'(</title>)', lambda _m: _m.group(1) + '\n' + markup + '\n' + jsonld, html_text, count=1, flags=re.I)
    elif '</head>' in html_text:
        html_text = html_text.replace('</head>', markup + '\n' + jsonld + '\n</head>', 1)
    return html_text

def inject(html_text, base=''):
    html_text = html_text.replace('<!-- @@NAV@@ -->', nav)
    state_note = state_authority_note(base)
    if state_note and 'class="b1031-state-source"' not in html_text:
        if '<!-- @@FOOTER@@ -->' in html_text:
            html_text = html_text.replace('<!-- @@FOOTER@@ -->', state_note + '\n<!-- @@FOOTER@@ -->', 1)
        elif '</main>' in html_text.lower():
            html_text = re.sub(r'(</main>)', state_note + '\n\\1', html_text, count=1, flags=re.I)
    if base not in NOINDEX_PAGES and '<!-- @@FOOTER@@ -->' in html_text:
        html_text = html_text.replace('<!-- @@FOOTER@@ -->', RELATED_HUBS_HTML + '\n<!-- @@FOOTER@@ -->', 1)
    html_text = html_text.replace('<!-- @@FOOTER@@ -->', footer)
    html_text = seo_inject(html_text, base)
    if base not in ANALYTICS_EXCLUDE and GA4_TAG not in html_text and '</head>' in html_text:
        html_text = html_text.replace('</head>', GA4_TAG + '\n</head>', 1)
        html_text = html_text.replace('</head>', ANALYTICS_SCRIPT + '\n</head>', 1)
    return html_text

# Pages that stay OPEN (no soft gate): home, registration, About group, contact,
# lead-gen/capability pages, all legal/compliance pages, auth pages, 404. Every
# other page (listings, offerings, insights/articles, resources, strategies, geo,
# glossary, calculators, sponsors, data-center, guides, property) gets the soft gate.
GATE_OPEN = set([
    'baker1031.html', 'index.html', 'request-access.html',
    'about.html', 'our-approach.html', 'methodology.html', 'due-diligence.html',
    'team-partners.html', 'jerry-baker-bio.html',
    'contact.html', 'who-we-serve.html', 'for-advisors-cpas.html', 'for-agents-brokers.html',
    'account.html', 'employee.html', '404.html',
    'privacy-policy.html', 'terms.html', 'ccpa.html', 'commitment-to-privacy.html',
    'reg-bi.html', 'accessibility.html', 'disclosures.html', 'sitemap.html', 'request-access.html',
])
GATE_TAG = '<script src="assets/softgate.js" defer></script>'

def gate(html_text, base):
    if base in GATE_OPEN:
        return html_text
    if GATE_TAG in html_text:
        return html_text
    if '</body>' in html_text:
        return html_text.replace('</body>', '  ' + GATE_TAG + '\n</body>', 1)
    return html_text + '\n' + GATE_TAG

shutil.rmtree(DIST, ignore_errors=True)
os.makedirs(DIST)
count = 0
import glob as _glob
for d in ('pages', 'pages-legacy'):
    for f in _glob.glob(os.path.join(ROOT, 'src', d, '*.html')):
        base = os.path.basename(f)
        if base in SKIP_SOURCE_PAGES:
            continue
        html_text = open(f).read()
        if base == 'investments.html':
            html_text = re.sub(r'<script type="application/json" id="directory-data">\n.*?\n</script>',
                               lambda _m: '<script type="application/json" id="directory-data">\n' + html_json(dir_rows) + '\n</script>',
                               html_text, flags=re.S)
        if base in ('employee.html', 'request-access.html'):
            html_text = html_text.replace('<script type="application/json" id="directory-data">[]</script>',
                                          '<script type="application/json" id="directory-data">' + html_json(dir_rows) + '</script>')
        if base == 'account.html':
            _bmindex = ([{'slug': r['url'].replace('.html', ''), 'name': r['name'], 'url': r['url']} for r in dir_rows]
                        + [{'slug': r['url'].replace('.html', ''), 'name': r['name'], 'url': r['url']} for r in sp_dir])
            html_text = re.sub(r'<script type="application/json" id="bookmark-index">.*?</script>',
                               lambda _m: '<script type="application/json" id="bookmark-index">' + html_json(_bmindex) + '</script>',
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
                               lambda _m: '<script type="application/json" id="directory-data">\n' + html_json(sp_dir) + '\n</script>',
                               html_text, flags=re.S)
        open(os.path.join(DIST, base), 'w').write(gate(inject(html_text, base), base))
        count += 1
for base, html_text in generated.items():
    open(os.path.join(DIST, base), 'w').write(gate(inject(html_text, base), base))
    count += 1

shutil.copytree(os.path.join(ROOT, 'src', 'assets'), os.path.join(DIST, 'assets'))
home_source = open(os.path.join(ROOT, 'src', 'pages', 'baker1031.html')).read()
open(os.path.join(DIST, 'index.html'), 'w').write(gate(inject(home_source, 'index.html'), 'index.html'))
print('built %d pages -> dist/' % (count + 1))

# ---------------------------------------------------------------- sitemap.xml
_pages = sorted(f for f in os.listdir(DIST) if f.endswith('.html'))
_urls = []
for _p in _pages:
    _raw = open(os.path.join(DIST, _p), encoding='utf-8', errors='replace').read()
    if re.search(r"<meta[^>]+name=[\"']robots[\"'][^>]+content=[\"'][^\"']*noindex", _raw, flags=re.I):
        continue
    loc = BASE_URL + '/' + ('' if _p == 'index.html' else _p)
    _urls.append('  <url><loc>%s</loc></url>' % loc)
open(os.path.join(DIST, 'sitemap.xml'), 'w').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + '\n'.join(_urls) + '\n</urlset>\n')
open(os.path.join(DIST, 'robots.txt'), 'w').write(
    'User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n' % BASE_URL)
print('sitemap.xml: %d urls' % len(_urls))

# ---------------------------------------------------------------- generated-site validation
def validate_dist():
    html_files = sorted(f for f in os.listdir(DIST) if f.endswith('.html'))
    failures = []
    thin_pages = []
    page_meta = {}
    quality = {'generated_at': BUILD_DATE, 'html_pages': len(html_files), 'thin_pages': [], 'citation_gaps': []}

    def plain(raw):
        raw = re.sub(r'<(style|script|noscript)[^>]*>.*?</\1>', ' ', raw, flags=re.S | re.I)
        raw = re.sub(r'<[^>]+>', ' ', raw)
        return re.sub(r'\s+', ' ', html_lib.unescape(raw)).strip()

    for base in html_files:
        path = os.path.join(DIST, base)
        raw = open(path, encoding='utf-8', errors='replace').read()
        robots = re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)', raw, flags=re.I)
        indexable = not robots or 'noindex' not in robots.group(1).lower()
        title_m = re.search(r'<title[^>]*>(.*?)</title>', raw, flags=re.S | re.I)
        desc_m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)', raw, flags=re.I)
        canonical_m = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', raw, flags=re.I)
        page_meta[base] = {
            'title': text_from_html(title_m.group(1)) if title_m else '',
            'description': html_lib.unescape(desc_m.group(1)) if desc_m else '',
            'canonical': canonical_m.group(1) if canonical_m else '',
            'indexable': indexable,
        }
        if indexable and not title_m:
            failures.append('%s: missing title' % base)
        if not desc_m:
            failures.append('%s: missing meta description' % base)
        if not canonical_m:
            failures.append('%s: missing canonical URL' % base)
        if not re.search(r'<meta[^>]+property=["\']og:title["\']', raw, flags=re.I) or not re.search(r'<meta[^>]+name=["\']twitter:card["\']', raw, flags=re.I):
            failures.append('%s: missing Open Graph or Twitter metadata' % base)
        placeholder_hits = re.findall(r'(?i)(?:Placeholder Article Title|Placeholder copy|Placeholder introduction|Placeholder body copy|Placeholder question|Placeholder answer|Placeholder bio|\[Placeholder regulatory disclosure)', raw)
        if placeholder_hits:
            failures.append('%s: public placeholder text: %s' % (base, ', '.join(sorted(set(placeholder_hits)))))
        ids = re.findall(r'\bid=["\']([^"\']+)["\']', raw, flags=re.I)
        seen = {}
        duplicates = []
        for value in ids:
            seen[value] = seen.get(value, 0) + 1
        duplicates = sorted(k for k, v in seen.items() if v > 1)
        if duplicates:
            failures.append('%s: duplicate HTML IDs: %s' % (base, ', '.join(duplicates)))
        blocks = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', raw, flags=re.S | re.I)
        for i, block in enumerate(blocks, 1):
            try:
                json.loads(block)
            except Exception as exc:
                failures.append('%s: invalid JSON-LD block %d (%s)' % (base, i, exc))
        word_count = len(re.findall(r"\b[\w’'-]+\b", plain(raw)))
        if indexable and word_count < 800:
            thin_pages.append({'page': base, 'words': word_count, 'reason': 'below 800-word review threshold'})
        state_slug = state_slug_for_page(base)
        if state_slug and STATE_TAX_AUTHORITIES[state_slug]['url'] not in raw:
            failures.append('%s: missing official state tax authority citation' % base)
        if indexable and base not in HUB_FILES and not page_citations(base, raw):
            quality['citation_gaps'].append(base)
        for href in re.findall(r'href=["\']([^"\']+)["\']', raw, flags=re.I):
            href = html_lib.unescape(href).split('#', 1)[0].split('?', 1)[0]
            if not href or href.startswith(('#', 'http://', 'https://', '//', 'mailto:', 'tel:', 'javascript:')):
                continue
            target = os.path.normpath(os.path.join(DIST, href.lstrip('/')))
            if href == '/':
                target = os.path.join(DIST, 'index.html')
            if not os.path.isfile(target):
                failures.append('%s: broken local link %s' % (base, href))

    title_groups = {}
    desc_groups = {}
    for base, meta in page_meta.items():
        if not meta['indexable']:
            continue
        title_groups.setdefault(meta['title'], []).append(base)
        desc_groups.setdefault(meta['description'], []).append(base)
    for title, pages in title_groups.items():
        if title and len(pages) > 1:
            failures.append('duplicate indexable title %r: %s' % (title, ', '.join(pages)))
    for desc, pages in desc_groups.items():
        if desc and len(pages) > 1:
            failures.append('duplicate indexable meta description on: %s' % ', '.join(pages))
    quality['thin_pages'] = thin_pages
    quality['duplicate_title_groups'] = {k: v for k, v in title_groups.items() if k and len(v) > 1}
    quality['duplicate_description_groups'] = {k: v for k, v in desc_groups.items() if k and len(v) > 1}
    quality['failure_count'] = len(failures)
    open(os.path.join(DIST, 'content-quality-report.json'), 'w').write(json.dumps(quality, indent=2, ensure_ascii=False))
    if failures:
        print('BUILD VALIDATION FAILED:')
        for failure in failures:
            print(' - ' + failure)
        raise SystemExit(1)
    print('validation: %d HTML pages passed metadata, canonical, structured-data, link, placeholder, and duplicate-ID gates' % len(html_files))
    print('content review report: %d thin pages and %d citation gaps recorded in dist/content-quality-report.json' % (len(thin_pages), len(quality['citation_gaps'])))

validate_dist()

# ---------------------------------------------------------------- llms.txt / llms-full.txt / favicon / manifest
# llms.txt: curated index (template), with the Current Offerings section refreshed from the sheet
_tpl = open(os.path.join(ROOT, 'data', 'llms-template.txt')).read()
_off_lines = []
for _row in LIST:
    if s(_row.get('Status')).lower() in ('closed', 'sold out', 'inactive'):
        continue
    _nm = s(_row['Investment Name'])
    _off_lines.append('- [%s](%s/%s)' % (_nm, '{{BASE}}', off_slug[_nm]))
_tpl = re.sub(r'## Current Offerings\n(?:- \[[^\n]*\n)*',
              '## Current Offerings\n' + '\n'.join(_off_lines) + '\n', _tpl, count=1)
open(os.path.join(DIST, 'llms.txt'), 'w').write(_tpl.replace('{{BASE}}', BASE_URL).replace('{{GENERATED}}', BUILD_DATE))

# llms-full.txt: concatenated plain text of every page for AI ingestion
def _strip_html(raw):
    raw = re.sub(r'<(style|script)[^>]*>.*?</\1>', ' ', raw, flags=re.S)
    raw = re.sub(r'<[^>]+>', ' ', raw)
    raw = raw.replace('&amp;', '&').replace('&nbsp;', ' ').replace('&middot;', '·').replace('&copy;', '(c)')
    return re.sub(r'[ \t]+', ' ', re.sub(r'\s*\n\s*', '\n', raw)).strip()

with open(os.path.join(DIST, 'llms-full.txt'), 'w') as _fh:
    _fh.write('# Baker 1031 Investments — full site text for AI ingestion\n# Index: %s/llms.txt\n\n' % BASE_URL)
    for _p in sorted(os.listdir(DIST)):
        if not _p.endswith('.html') or _p in ('404.html', 'article-template.html', 'baker1031.html'):
            continue
        _raw = open(os.path.join(DIST, _p), encoding='utf-8', errors='replace').read()
        if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex', _raw, flags=re.I):
            continue
        _title = re.search(r'<title>(.*?)</title>', _raw, re.S)
        _body = _strip_html(_raw)
        # drop repeated nav/footer noise: cut everything before the breadcrumb "Home ❯" and after "Continue Exploring"
        _i = _body.find('Home ❯')
        _j = _body.find('Continue Exploring Baker 1031')
        if 0 <= _i < (_j if _j > 0 else len(_body)):
            _body = _body[_i:(_j if _j > 0 else len(_body))]
        _fh.write('\n===== PAGE: %s/%s =====\n%s\n%s\n' % (
            BASE_URL, _p, (_title.group(1).strip() if _title else _p), _body))

# favicon + web manifest
shutil.copy(os.path.join(ROOT, 'data', 'favicon.ico'), os.path.join(DIST, 'favicon.ico'))
open(os.path.join(DIST, 'site.webmanifest'), 'w').write(json.dumps({
    'name': 'Baker 1031 Investments', 'short_name': 'Baker 1031',
    'icons': [{'src': '/assets/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
              {'src': '/assets/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}],
    'theme_color': '#243856', 'background_color': '#243856', 'display': 'standalone', 'start_url': '/'}))
print('llms.txt + llms-full.txt + favicon + manifest written')
