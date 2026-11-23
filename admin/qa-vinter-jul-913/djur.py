# QA #913: ställ djuren via proxyns REST (emulatorn). python3 djur.py <origin> <feedCount renis> [klack-snois]
import json, sys, time, urllib.request
origin, feed = sys.argv[1], int(sys.argv[2])
url = origin + "/v1/projects/pluggportalen-so-2026/databases/(default)/documents/studentData/kc01"
h = {"Authorization": "Bearer owner", "Content-Type": "application/json"}
d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=h)))["fields"]
pets = d["pets"]["arrayValue"]["values"]
for p in pets:
    f = p["mapValue"]["fields"]
    if f.get("speciesId", {}).get("stringValue") == "renis":
        f["feedCount"] = {"integerValue": str(feed)}
    if len(sys.argv) > 3 and f.get("eggSpecies", {}).get("stringValue") == "snois" and "stringValue" not in f.get("speciesId", {}):
        f["eggBoughtAt"] = {"integerValue": str(int(time.time() * 1000) - 4 * 24 * 3600 * 1000)}
body = {"fields": {"pets": {"arrayValue": {"values": pets}},
                   "floorApples": {"arrayValue": {"values": [{"mapValue": {"fields": {"id": {"stringValue": f"qa{feed}"}, "x": {"doubleValue": 50}, "y": {"doubleValue": 80}}}}]}}}}
req = urllib.request.Request(url + "?updateMask.fieldPaths=pets&updateMask.fieldPaths=floorApples", data=json.dumps(body).encode(), headers=h, method="PATCH")
print(urllib.request.urlopen(req).status)
