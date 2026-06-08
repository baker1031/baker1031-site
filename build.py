#!/usr/bin/env python3
# Baker 1031 - build-time generator for public /properties/<slug> listing pages.
# Runs in the Netlify build. Stdlib only (no pip needed). Fetches the LIVE published
# Google Sheet CSV and regenerates one static, indexable, schema-rich page per qualifying
# offering, then refreshes the sitemap. Delisted offerings are removed automatically.
#
# >>> WHICH ROWS BECOME PUBLIC PAGES <<<  edit PUBLISH_STATUSES below.
#   Default: offerings whose Status is "Available" or "Limited Availability".
#   To hide an offering, set its Status in the Sheet to anything else
#   (e.g. "Closed", "Draft", "Realized").
import urllib.request, csv, io, os, re, html, json, sys, datetime, base64, shutil

PUBLISH_STATUSES = {"available", "limited availability", "coming soon / under review"}

CSV_URL = ("https://docs.google.com/spreadsheets/d/e/"
           "2PACX-1vR4w59pWwRky3k2E92K1oZXGVUQPKnhtq20galh5MN917vowbxMqfINBd_Sahhjn_BT4ncSIl9aUHV3"
           "/pub?gid=0&single=true&output=csv")

ROOT = os.path.dirname(os.path.abspath(__file__))
SKELETON = os.path.join(ROOT, "property-types", "Industrial", "index.html")
BASE = "https://www.baker1031.com"

SP = json.loads("{\"aei-capital-corporation\": \"AEI\", \"smartstop\": \"Blue-Door\", \"bluerock\": \"Bluerock\", \"bridgeview\": \"BridgeView\", \"cantor-fitzgerald\": \"Cantor-Fitzgerald\", \"capital-square\": \"Capital-Square\", \"carter-exchange\": \"Carter-Exchange\", \"exchangeright\": \"ExchangeRight\", \"four-springs-capital\": \"Four-Springs\", \"griffin-capital\": \"Griffin-Capital\", \"hines\": \"Hines\", \"inland\": \"Inland\", \"livingston-street-capital\": \"Livingston-Street-Capital\", \"moody-national\": \"Moody-National\", \"net-lease-capital-advisors\": \"Net-Lease-Capital\", \"nexpoint\": \"NexPoint\", \"passco\": \"Passco\", \"peachtree-group\": \"Peachtree-Group\", \"starboard-realty-advisors\": \"Starboard\", \"syndicated-equities\": \"Syndicated-Equities\", \"time-equities\": \"Time-Equities\", \"trilogy-real-estate-group\": \"Trilogy\", \"apollo-global-management\": \"Apollo\", \"ares-management\": \"Ares\", \"blackstone\": \"Blackstone\", \"fortress-investment-group\": \"Fortress\", \"invesco\": \"Invesco\", \"jll\": \"JLL\", \"jwcm\": \"JWCM\"}")
PTMAP = json.loads("{\"Multifamily\": \"Multifamily\", \"Industrial\": \"Industrial\", \"Medical\": \"Medical\", \"Office\": \"Office\", \"Hospitality\": \"Hospitality\", \"Self Storage\": \"Self-Storage\", \"Self-Storage\": \"Self-Storage\", \"Student Housing\": \"Student-Housing\", \"Senior Living\": \"Senior-Living\", \"Senior Housing\": \"Senior-Living\", \"Net Lease\": \"Net-Lease-Retail\", \"Net-Lease\": \"Net-Lease-Retail\", \"Retail\": \"Net-Lease-Retail\", \"Data Center\": \"Data-Centers\", \"Data Centers\": \"Data-Centers\", \"Manufactured Housing\": \"Manufactured-Housing\"}")
HEAD_FIXED = base64.b64decode("PGxpbmsgcmVsPSJwcmVjb25uZWN0IiBocmVmPSJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tIj48bGluayByZWw9InByZWNvbm5lY3QiIGhyZWY9Imh0dHBzOi8vZm9udHMuZ3N0YXRpYy5jb20iIGNyb3Nzb3JpZ2luPjxsaW5rIHJlbD0icHJlbG9hZCIgYXM9InN0eWxlIiBocmVmPSJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tL2NzczI/ZmFtaWx5PVNvdXJjZStTZXJpZis0OndnaHRAMzAwOzQwMDs1MDA7NjAwJmZhbWlseT1JbnRlcjp3Z2h0QDQwMDs1MDA7NjAwOzcwMCZkaXNwbGF5PXN3YXAiIG9ubG9hZD0idGhpcy5vbmxvYWQ9bnVsbDt0aGlzLnJlbD1cJ3N0eWxlc2hlZXRcJyI+PG5vc2NyaXB0PjxsaW5rIHJlbD0ic3R5bGVzaGVldCIgaHJlZj0iaHR0cHM6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3MyP2ZhbWlseT1Tb3VyY2UrU2VyaWYrNDp3Z2h0QDMwMDs0MDA7NTAwOzYwMCZmYW1pbHk9SW50ZXI6d2dodEA0MDA7NTAwOzYwMDs3MDAmZGlzcGxheT1zd2FwIj48L25vc2NyaXB0PjxsaW5rIHJlbD0ic3R5bGVzaGVldCIgaHJlZj0iL3Byb3BlcnRpZXMvYXNzZXRzL3BwYWdlLmNzcz92PTIwMjYwNjExIj48bGluayByZWw9Imljb24iIHR5cGU9ImltYWdlL3BuZyIgaHJlZj0iL2Fzc2V0cy9pbWcvZmF2aWNvbi5wbmciPjxsaW5rIHJlbD0iaWNvbiIgdHlwZT0iaW1hZ2UvcG5nIiBzaXplcz0iMzJ4MzIiIGhyZWY9Ii9hc3NldHMvaW1nL2Zhdmljb24tMzIucG5nIj48bGluayByZWw9ImFwcGxlLXRvdWNoLWljb24iIGhyZWY9Ii9hc3NldHMvaW1nL2FwcGxlLXRvdWNoLWljb24ucG5nIj48c2NyaXB0Pi8qQkstSFNERUZFUiovKGZ1bmN0aW9uKCl7dmFyIGRvbmU9MCxldj1bInNjcm9sbCIsIm1vdXNlbW92ZSIsInRvdWNoc3RhcnQiLCJrZXlkb3duIiwiY2xpY2siXTtmdW5jdGlvbiBsb2FkKCl7aWYoZG9uZSlyZXR1cm47ZG9uZT0xO2V2LmZvckVhY2goZnVuY3Rpb24oZSl7d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoZSxsb2FkKX0pO3ZhciBzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoInNjcmlwdCIpO3MudHlwZT0idGV4dC9qYXZhc2NyaXB0IjtzLmlkPSJocy1zY3JpcHQtbG9hZGVyIjtzLmFzeW5jPTE7cy5kZWZlcj0xO3Muc3JjPSIvL2pzLW5hMi5ocy1zY3JpcHRzLmNvbS8yNDQ4OTE5NjkuanMiO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocyk7fWV2LmZvckVhY2goZnVuY3Rpb24oZSl7d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoZSxsb2FkLHtwYXNzaXZlOnRydWUsb25jZTp0cnVlfSl9KTtzZXRUaW1lb3V0KGxvYWQsNDAwMCk7fSkoKTs8L3NjcmlwdD48c3R5bGU+LmRwLWhlcm97bWFyZ2luOjAgMCAxOHB4fS5kcC1leWVicm93e2ZvbnQ6NjAwIDEycHgvMS40IHZhcigtLXNhbnMsIkludGVyIik7bGV0dGVyLXNwYWNpbmc6LjE0ZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2NvbG9yOnZhcigtLW5hdnksIzBhMjU0MCk7bWFyZ2luOjAgMCAxMHB4fS5kcC1leWVicm93IGF7Y29sb3I6aW5oZXJpdDt0ZXh0LWRlY29yYXRpb246bm9uZTtib3JkZXItYm90dG9tOjFweCBzb2xpZCByZ2JhKDEwLDM3LDY0LC4zKX0uZHAtc3Vie2NvbG9yOnZhcigtLW11dGVkLCM1YjZiN2QpO2ZvbnQ6NDAwIDE3cHgvMS42IHZhcigtLXNhbnMsIkludGVyIik7bWFyZ2luOi40ZW0gMCAwfS5kcC1mYWN0c3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMTUwcHgsMWZyKSk7Z2FwOjFweDtiYWNrZ3JvdW5kOnZhcigtLWxpbmUsI2RjZTNlYSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lLCNkY2UzZWEpO2JvcmRlci1yYWRpdXM6MTBweDtvdmVyZmxvdzpoaWRkZW47bWFyZ2luOjI0cHggMH0uZHAtZmFjdHtiYWNrZ3JvdW5kOnZhcigtLXBhcGVyLCNmZmYpO3BhZGRpbmc6MTZweCAxOHB4fS5kcC1mYWN0IC5re2ZvbnQ6NjAwIDExcHgvMS4zIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi4xZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2NvbG9yOnZhcigtLW11dGVkLCM1YjZiN2QpO21hcmdpbjowIDAgNnB4fS5kcC1mYWN0IC52e2ZvbnQ6NTAwIDIwcHgvMS4yIHZhcigtLXNlcmlmLCJTb3VyY2UgU2VyaWYgNCIpO2NvbG9yOnZhcigtLWluaywjMGMxYzJlKX0uZHAtc2NoZWR7d2lkdGg6MTAwJTtib3JkZXItY29sbGFwc2U6Y29sbGFwc2U7bWFyZ2luOjE0cHggMCA2cHg7Zm9udDo0MDAgMTVweC8xLjUgdmFyKC0tc2Fucyl9LmRwLXNjaGVkIHRoLC5kcC1zY2hlZCB0ZHt0ZXh0LWFsaWduOmxlZnQ7cGFkZGluZzo5cHggMTJweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lLCNkY2UzZWEpfS5kcC1zY2hlZCB0aHtmb250OjYwMCAxMnB4LzEuMyB2YXIoLS1zYW5zKTtsZXR0ZXItc3BhY2luZzouMDhlbTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Y29sb3I6dmFyKC0tbXV0ZWQpfS5kcC1zY2hlZCB0ZDpsYXN0LWNoaWxkLC5kcC1zY2hlZCB0aDpsYXN0LWNoaWxke3RleHQtYWxpZ246cmlnaHR9LmRwLWhse2xpc3Qtc3R5bGU6bm9uZTtwYWRkaW5nOjA7bWFyZ2luOjE0cHggMDtkaXNwbGF5OmdyaWQ7Z2FwOjEycHh9LmRwLWhsIGxpe3BhZGRpbmc6MTRweCAxNnB4O2JhY2tncm91bmQ6dmFyKC0tdGludCwjZWVmNGZhKTtib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tbmF2eSwjMGEyNTQwKTtib3JkZXItcmFkaXVzOjAgOHB4IDhweCAwO2ZvbnQ6NDAwIDE1cHgvMS42NSB2YXIoLS1zYW5zKTtjb2xvcjp2YXIoLS1pbmspfS5kcC1jdGF7ZGlzcGxheTpmbGV4O2ZsZXgtd3JhcDp3cmFwO2dhcDoxMHB4O21hcmdpbjoyMnB4IDB9LmRwLWN0YSBhe2Rpc3BsYXk6aW5saW5lLWJsb2NrO3BhZGRpbmc6MTJweCAyMnB4O2JvcmRlci1yYWRpdXM6NDBweDtmb250OjYwMCAxNHB4LzEgdmFyKC0tc2Fucyk7dGV4dC1kZWNvcmF0aW9uOm5vbmV9LmRwLWN0YSAucHtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50O2NvbG9yOiMwYTI1NDA7Ym9yZGVyOjFweCBzb2xpZCAjMGEyNTQwfS5kcC1jdGEgLmd7YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjp2YXIoLS1uYXZ5LCMwYTI1NDApO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbmF2eSwjMGEyNTQwKX0uZHAtZGlzY3ttYXJnaW46MzBweCAwIDA7cGFkZGluZzoxOHB4IDIwcHg7YmFja2dyb3VuZDp2YXIoLS1wYXBlci0yLCNmM2Y2ZjkpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxMHB4O2ZvbnQ6NDAwIDEyLjVweC8xLjcgdmFyKC0tc2Fucyk7Y29sb3I6dmFyKC0tbXV0ZWQpfS5kcC1kaXNjIGgye2ZvbnQ6NjAwIDEycHgvMS4zIHZhcigtLXNhbnMpO2xldHRlci1zcGFjaW5nOi4xZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2NvbG9yOnZhcigtLWluayk7bWFyZ2luOjAgMCA4cHh9LmRwLXNlY3ttYXJnaW46MzBweCAwfS5kcC1zZWMgaDJ7Zm9udDo1MDAgMjJweC8xLjMgdmFyKC0tc2VyaWYpO2NvbG9yOnZhcigtLWluayk7bWFyZ2luOjAgMCAxMHB4fS5kcC1zZWMgcHtmb250OjQwMCAxNnB4LzEuNyB2YXIoLS1zYW5zKTtjb2xvcjp2YXIoLS1pbmspfS5kcC1ub3Rle2ZvbnQtc2l6ZToxMnB4O2NvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tdG9wOjZweH08L3N0eWxlPjxzdHlsZSBpZD0iYjEwMzEtZ2F0ZS1jc3MiPi5iMTAzMS1nYXRle2Rpc3BsYXk6bm9uZX1odG1sLmIxMDMxLW5lZWRnYXRlIC5iMTAzMS1nYXRle2Rpc3BsYXk6ZmxleH1odG1sLmIxMDMxLW5lZWRnYXRlLGh0bWwuYjEwMzEtbmVlZGdhdGUgYm9keXtvdmVyZmxvdzpoaWRkZW59LmIxMDMxLWdhdGV7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjIxNDc0ODMwMDA7YmFja2dyb3VuZDpyZ2JhKDYsMjUsNDYsLjU1KTstd2Via2l0LWJhY2tkcm9wLWZpbHRlcjpibHVyKDJweCk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMnB4KTthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjIwcHg7Zm9udC1mYW1pbHk6IkludGVyIixzeXN0ZW0tdWksLWFwcGxlLXN5c3RlbSxzYW5zLXNlcmlmfS5iMTAzMS1nYXRlX19ib3h7YmFja2dyb3VuZDojZmZmO21heC13aWR0aDo3NjBweDt3aWR0aDoxMDAlO21heC1oZWlnaHQ6OTB2aDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2JvcmRlci1yYWRpdXM6MTJweDtib3gtc2hhZG93OjAgMzBweCA4MHB4IHJnYmEoNiwyNSw0NiwuMzUpO292ZXJmbG93OmhpZGRlbn0uYjEwMzEtZ2F0ZV9faGR7cGFkZGluZzoyOHB4IDM2cHggNHB4O3RleHQtYWxpZ246Y2VudGVyO2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNmM2Y2Zjl9LmIxMDMxLWdhdGVfX2hkIGltZ3toZWlnaHQ6MzBweDttYXJnaW46MCBhdXRvIDE0cHg7ZGlzcGxheTpibG9ja30uYjEwMzEtZ2F0ZV9faGQgaDJ7Zm9udC1mYW1pbHk6IlNvdXJjZSBTZXJpZiA0IixHZW9yZ2lhLHNlcmlmO2NvbG9yOiMwYTI1NDA7Zm9udC1zaXplOjIycHg7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbjowfS5iMTAzMS1nYXRlX19oZCBwe2NvbG9yOiM1YjZiN2Q7Zm9udC1zaXplOjEyLjVweDttYXJnaW46MTBweCAwIDE2cHg7Zm9udC13ZWlnaHQ6NjAwO2xldHRlci1zcGFjaW5nOi4wMWVtfS5iMTAzMS1nYXRlX19iZHtwYWRkaW5nOjE4cHggMzZweDtvdmVyZmxvdy15OmF1dG87Y29sb3I6IzBjMWMyZTtmb250LXNpemU6MTMuNXB4O2xpbmUtaGVpZ2h0OjEuNzstd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzp0b3VjaH0uYjEwMzEtZ2F0ZV9fYmQgcHttYXJnaW46MCAwIDEzcHh9LmIxMDMxLWdhdGVfX2JkIHA6bGFzdC1jaGlsZHttYXJnaW4tYm90dG9tOjB9LmIxMDMxLWdhdGVfX2JkIHN0cm9uZ3tjb2xvcjojMGEyNTQwfS5iMTAzMS1nYXRlX19iZCBhe2NvbG9yOiMwYTI1NDA7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZX0uYjEwMzEtZ2F0ZV9fZnR7cGFkZGluZzoxNnB4IDM2cHg7Ym9yZGVyLXRvcDoxcHggc29saWQgI2RjZTNlYTtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxNHB4O2JhY2tncm91bmQ6I2YzZjZmOX0uYjEwMzEtZ2F0ZV9fY2hre2Rpc3BsYXk6ZmxleDtnYXA6OXB4O2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7Zm9udC1zaXplOjEzcHg7Y29sb3I6IzBjMWMyZTtsaW5lLWhlaWdodDoxLjU7Y3Vyc29yOnBvaW50ZXI7dXNlci1zZWxlY3Q6bm9uZX0uYjEwMzEtZ2F0ZV9fY2hrIGlucHV0e21hcmdpbi10b3A6MnB4O3dpZHRoOjE2cHg7aGVpZ2h0OjE2cHg7ZmxleDpub25lO2FjY2VudC1jb2xvcjojMGEyNTQwO2N1cnNvcjpwb2ludGVyfS5iMTAzMS1nYXRlX19idG5ze2Rpc3BsYXk6ZmxleDtnYXA6MTJweDtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1lbmQ7ZmxleC13cmFwOndyYXB9LmIxMDMxLWdhdGVfX2Z0IGJ1dHRvbntmb250LWZhbWlseTppbmhlcml0O2ZvbnQtc2l6ZToxMy41cHg7Zm9udC13ZWlnaHQ6NjAwO3BhZGRpbmc6MTJweCAyNHB4O2JvcmRlci1yYWRpdXM6OHB4O2N1cnNvcjpwb2ludGVyO2JvcmRlcjoxcHggc29saWQgdHJhbnNwYXJlbnQ7dHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC4xNXN9LmIxMDMxLWdhdGVfX2xlYXZle2JhY2tncm91bmQ6I2U2ZWJmMDtjb2xvcjojNWI2YjdkO2JvcmRlci1jb2xvcjojZDNkYmU0fS5iMTAzMS1nYXRlX19sZWF2ZTpob3ZlcntiYWNrZ3JvdW5kOiNkOWUwZTh9LmIxMDMxLWdhdGVfX2FjY2VwdHtiYWNrZ3JvdW5kOiMwYTI1NDA7Y29sb3I6I2ZmZn0uYjEwMzEtZ2F0ZV9fYWNjZXB0OmhvdmVye2JhY2tncm91bmQ6IzA2MTkyZX0uYjEwMzEtZ2F0ZV9fYWNjZXB0OmRpc2FibGVke2JhY2tncm91bmQ6IzZmYzNlZTtjb2xvcjojZjNmNmY5O2N1cnNvcjpub3QtYWxsb3dlZH0uYjEwMzEtZ2F0ZV9fYWNjZXB0OmRpc2FibGVkOmhvdmVye2JhY2tncm91bmQ6IzZmYzNlZX1AbWVkaWEobWF4LXdpZHRoOjU2MHB4KXsuYjEwMzEtZ2F0ZV9faGQsLmIxMDMxLWdhdGVfX2JkLC5iMTAzMS1nYXRlX19mdHtwYWRkaW5nLWxlZnQ6MjBweDtwYWRkaW5nLXJpZ2h0OjIwcHh9LmIxMDMxLWdhdGVfX2J0bnN7anVzdGlmeS1jb250ZW50OnN0cmV0Y2h9LmIxMDMxLWdhdGVfX2J0bnMgYnV0dG9ue2ZsZXg6MSAxIGF1dG99fTwvc3R5bGU+PHNjcmlwdD50cnl7aWYoIWxvY2FsU3RvcmFnZS5nZXRJdGVtKCJiMTAzMV9kaXNjbGFpbWVyX29rIikpZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTGlzdC5hZGQoImIxMDMxLW5lZWRnYXRlIik7fWNhdGNoKGUpe2RvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc0xpc3QuYWRkKCJiMTAzMS1uZWVkZ2F0ZSIpO308L3NjcmlwdD4=").decode("utf-8")


CAP_DISC = (' <strong>Cap Rate.</strong> The &ldquo;Net-Adjusted Equivalency Cap Rate,&rdquo; shown as Cap Rate, '
 'is a comparative metric designed to normalize the returns of an all-inclusive Delaware Statutory Trust (DST) '
 'against a direct-ownership Net Lease (NNN) property. This metric is calculated by &ldquo;reversing&rdquo; a target '
 'cash-on-cash return to reconstruct a required Net Operating Income (NOI), adding back debt service and amortizing '
 'estimated acquisition, financing, and disposition &ldquo;friction&rdquo; costs over a 10-year holding period. This '
 'calculation is provided for educational and illustrative purposes only and is not a guarantee of future performance '
 'or an offer to sell securities. Limitations include the reliance on generalized market assumptions; individual '
 'property performance, actual interest rates, and specific transaction costs will vary. This should not be used as the '
 'primary basis for any investment decision. Estimates are derived from the following industry benchmarks: Acquisition '
 'Costs (2.5% &ndash; NAR Commercial), Loan Fees (1.0% &ndash; CREFC Guidelines), Sale Costs (6.0% &ndash; Altus Group), '
 'and Debt Assumptions (6.5% Interest/30-Yr Amort. &ndash; Select Commercial).')

def e(x): return html.escape(str(x)) if x is not None else ""
def usd(v):
    try: v=float(str(v).replace(",","").replace("$",""))
    except: return None
    return "${:,.0f}".format(v) if v>0 else None
def pct(v):
    try: v=float(v)
    except: return None
    return "{:.2f}%".format(v*100) if v>0 else None
def slugify(u):
    s=str(u or "").strip().rstrip("/").split("/")[-1].lower()
    return re.sub(r"[^a-z0-9]+","-",s).strip("-")
def g(r,i): return r[i] if (i is not None and 0<=i<len(r)) else None

def get_csv():
    f=os.environ.get("BK_CSV_FILE")
    if f and os.path.exists(f): return open(f,encoding="utf-8").read()
    req=urllib.request.Request(CSV_URL, headers={"User-Agent":"baker1031-build"})
    with urllib.request.urlopen(req, timeout=45) as r: return r.read().decode("utf-8")

def col_index(headers):
    H=[(h or "").strip().lower() for h in headers]
    def find(pred, default):
        for k,h in enumerate(H):
            if pred(h): return k
        return default
    ix={}
    ix["name"]=find(lambda h: h in ("investment name","name"),0)
    ix["sponsor"]=find(lambda h: h=="sponsor",1)
    ix["status"]=find(lambda h: h=="status",3)
    ix["off"]=find(lambda h: h=="total offering",4)
    ix["eq"]=find(lambda h: h=="equity",5)
    ix["debt"]=find(lambda h: h=="debt",6)
    ix["ltv"]=find(lambda h: "ltv" in h,7)
    ix["type"]=find(lambda h: h=="property type",11)
    ix["loc"]=find(lambda h: h=="location",12)
    ix["desc"]=find(lambda h: h=="description",18)
    for n in range(1,6): ix["hl%d"%n]=find(lambda h,n=n: h=="highlight %d"%n,18+n)
    for n in range(1,11): ix["y%d"%n]=find(lambda h,n=n: h=="y%d"%n,26+n)
    ix["avg"]=find(lambda h: h=="average yield",37)
    ix["cap"]=find(lambda h: h=="cap rate equivalent",39)
    ix["min"]=find(lambda h: h=="minimum investment",49)
    ix["url"]=find(lambda h: h=="url",54)
    ix["spurl"]=find(lambda h: h=="sponsor url",55)
    return ix

tpl=open(SKELETON,encoding="utf-8").read()
bs=tpl.index("<body>")+6; ms=tpl.index("<main"); me=tpl.index("</main>")+7
TOP=tpl[bs:ms]; BOTTOM=tpl[me:]

def render(slug,r,ix):
    name=g(r,ix["name"]); sponsor=g(r,ix["sponsor"]) or ""
    typ=(g(r,ix["type"]) or "").strip(); loc=g(r,ix["loc"]) or ""
    spseg=(g(r,ix["spurl"]) or "").split("/")[-1].lower(); spslug=SP.get(spseg,spseg)
    url=BASE+"/properties/"+slug
    desc=(g(r,ix["desc"]) or "").strip(); metad=re.sub(r"\s+"," ",desc)[:155]
    title=name+" | DST 1031 Offering | Baker 1031"
    ltv=g(r,ix["ltv"]); debt=g(r,ix["debt"]); off=g(r,ix["off"]); eq=g(r,ix["eq"])
    try: debt_zero=float(str(debt).replace(",","").replace("$",""))==0
    except: debt_zero=False
    try: ltv_zero=("0.00" in str(ltv)) or (float(ltv)==0)
    except: ltv_zero=False
    facts=[]
    for k,v in [("Total Offering",usd(off)),("Equity Offering",usd(eq)),
                ("Debt", usd(debt) or ("None - all-equity" if (debt_zero and off) else None)),
                ("Loan-to-Value", (ltv if (ltv and not ltv_zero) else ("0% - all-equity" if off else None))),
                ("Minimum Investment",usd(g(r,ix["min"]))),("Avg. Cash-on-Cash*",pct(g(r,ix["avg"]))),
                ("Cap Rate",pct(g(r,ix["cap"])))]:
        if v: facts.append((k,v))
    factshtml="".join('<div class="dp-fact"><div class="k">%s</div><div class="v">%s</div></div>'%(e(k),e(v)) for k,v in facts)
    facts_wrap=('<div class="dp-facts">'+factshtml+"</div>") if factshtml else ""
    ptslug=PTMAP.get(typ)
    typdisp=(('<a href="/property-types/%s">%s</a>'%(ptslug,e(typ))) if ptslug else e(typ)) if typ else ""
    eyebrow=" &nbsp;·&nbsp; ".join([p for p in [typdisp,e(loc)] if p])
    hls=[g(r,ix["hl%d"%n]) for n in range(1,6) if g(r,ix["hl%d"%n])]
    hlsec=('<div class="dp-sec"><h2>Investment highlights</h2><ul class="dp-hl">%s</ul></div>'%("".join("<li>%s</li>"%e(h) for h in hls))) if hls else ""
    def fnum(x):
        try: v=float(x); return v if v>0 else None
        except: return None
    yrs=[(n,fnum(g(r,ix["y%d"%n]))) for n in range(1,11)]; yrs=[(n,v) for n,v in yrs if v]
    schsec=('<div class="dp-sec"><h2>Projected distribution schedule</h2><table class="dp-sched"><thead><tr><th>Period</th><th>Annualized rate*</th></tr></thead><tbody>%s</tbody></table><p class="dp-note">*Sponsor-projected, net of fees and program expenses. Projections are not guaranteed.</p></div>'%("".join("<tr><td>Year %d</td><td>%.2f%%</td></tr>"%(n,v*100) for n,v in yrs))) if yrs else ""
    descsec=('<div class="dp-sec"><h2>Overview</h2><p>%s</p></div>'%e(desc)) if desc else ""
    sponsorsec=('<div class="dp-sec"><h2>Sponsor</h2><p>This offering is sponsored by <a href="/sponsors/%s">%s</a>. Baker 1031 Investments is independent of the sponsor and provides advisory and brokerage services to accredited investors.</p></div>'%(e(spslug),e(sponsor))) if sponsor else ""
    cta='<div class="dp-cta"><a class="p" href="mailto:invest@baker1031.com?subject=Offering%20documents%20request:%20'+e(name)+'&body=Please%20send%20the%20offering%20documents%20(PPM)%20for%20'+e(name)+'.">Request offering documents</a><a class="g" href="/contact">Speak with Jerry</a><a class="g" href="/schedule">Schedule a call</a></div>'
    disc='<div class="dp-disc"><h2>Important disclosures</h2>This material is for accredited investors only and is not an offer to sell or a solicitation of an offer to buy any security. Any offering of interests is made solely pursuant to the sponsor\u2019s Private Placement Memorandum (PPM), which should be read in its entirety before investing. Securities offered through Aurora Securities, Inc., member FINRA/SIPC; Baker 1031 Investments is independent of Aurora Securities, Inc. Figures shown are sponsor-reported and have not been independently verified by Baker 1031; performance figures, where shown, are net of all fees, sales load, and program expenses, and reflect realized or sponsor-projected results that are not guaranteed. Past performance does not indicate future results. DST interests are illiquid, speculative, and involve risk of loss, including loss of principal. Individual tax results vary; consult your own tax and legal advisors. Minimum investment $50,000.</div>'
    if pct(g(r,ix["cap"])):
        disc=disc.replace("Minimum investment $50,000.</div>","Minimum investment $50,000."+CAP_DISC+"</div>")
    main=('<main class="wrap narrow"><nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> &nbsp;/&nbsp; <a href="/properties">Properties</a> &nbsp;/&nbsp; '+e(name)+'</nav>'
          '<div class="dp-hero"><div class="dp-eyebrow">'+eyebrow+'</div><h1>'+e(name)+'</h1>'
          '<p class="dp-sub">Delaware Statutory Trust (DST) &middot; 1031 exchange&#8209;eligible'+((" &middot; sponsored by "+e(sponsor)) if sponsor else "")+'</p></div>'
          +facts_wrap+descsec+hlsec+schsec+sponsorsec+cta+disc+'</main>')
    ld={"@context":"https://schema.org","@type":"Product","name":name,"category":typ or "Delaware Statutory Trust","description":metad,"brand":({"@type":"Organization","name":sponsor} if sponsor else "Baker 1031 Investments"),"url":url}
    bc={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":BASE+"/"},{"@type":"ListItem","position":2,"name":"Properties","item":BASE+"/properties"},{"@type":"ListItem","position":3,"name":name,"item":url}]}
    ldhtml='<script type="application/ld+json">'+json.dumps(ld)+'</script><script type="application/ld+json">'+json.dumps(bc)+'</script>'
    meta=('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
          '<meta name="robots" content="index, follow"><link rel="canonical" href="'+url+'"><title>'+e(title)+'</title>'
          '<meta name="description" content="'+e(metad)+'">'
          '<meta property="og:type" content="website"><meta property="og:site_name" content="Baker 1031 Investments"><meta property="og:locale" content="en_US">'
          '<meta property="og:title" content="'+e(title)+'"><meta property="og:description" content="'+e(metad)+'"><meta property="og:url" content="'+url+'">'
          '<meta property="og:image" content="'+BASE+'/assets/img/og-cover.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
          '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+e(title)+'"><meta name="twitter:description" content="'+e(metad)+'"><meta name="twitter:image" content="'+BASE+'/assets/img/og-cover.png">')
    return meta+HEAD_FIXED+ldhtml+"</head><body><!--BK-GEN-LISTING-->"+TOP+main+BOTTOM

def update_sitemap(published):
    sp=os.path.join(ROOT,"sitemap.xml")
    if not os.path.exists(sp): return
    xml=open(sp,encoding="utf-8").read()
    def is_listing(loc):
        m=re.match(r"^"+re.escape(BASE)+r"/properties/([a-z0-9-]+)$", loc)
        return bool(m) and m.group(1) not in ("detail","portfolio-builder")
    xml=re.sub(r"<url>\s*<loc>([^<]+)</loc>.*?</url>", lambda m: "" if is_listing(m.group(1).strip()) else m.group(0), xml, flags=re.S)
    today=datetime.date.today().isoformat()
    block="".join("<url><loc>%s/properties/%s</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>"%(BASE,s,today) for s in sorted(published))
    xml=xml.replace("</urlset>", block+"</urlset>")
    open(sp,"w",encoding="utf-8").write(xml)

def main():
    rows=list(csv.reader(io.StringIO(get_csv())))
    if not rows: print("ERROR: empty CSV",file=sys.stderr); sys.exit(1)
    ix=col_index(rows[0]); published={}; skipped=0
    for r in rows[1:]:
        name=g(r,ix["name"]); url=g(r,ix["url"]); status=(g(r,ix["status"]) or "").strip().lower()
        if not name or not url: continue
        if status not in PUBLISH_STATUSES: skipped+=1; continue
        slug=slugify(url)
        if not slug: continue
        d=os.path.join(ROOT,"properties",slug); os.makedirs(d,exist_ok=True)
        open(os.path.join(d,"index.html"),"w",encoding="utf-8").write(render(slug,r,ix)); published[slug]=name
    propdir=os.path.join(ROOT,"properties"); removed=0
    for d in os.listdir(propdir):
        full=os.path.join(propdir,d,"index.html")
        if d in ("assets","portfolio-builder") or not os.path.isfile(full) or d in published: continue
        try:
            if "<!--BK-GEN-LISTING-->" in open(full,encoding="utf-8").read():
                shutil.rmtree(os.path.join(propdir,d)); removed+=1
        except Exception: pass
    update_sitemap(published)
    print("[build] published %d listing pages | skipped %d non-published rows | removed %d delisted"%(len(published),skipped,removed))

if __name__=="__main__": main()
