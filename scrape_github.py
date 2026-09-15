import urllib.request
import re

url = "https://github.com/fassilandualem1-netizen/photoguard/actions/runs/34876287282"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    print("Page fetched")
    # try to find the error in the HTML
    if "FAILURE" in html or "Exception" in html or "error" in html.lower():
        print("Found failure markers in HTML")
except Exception as e:
    print("Error:", e)
