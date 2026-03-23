"""
Fetch Deals and Accounts from Zoho Bigin CRM.
Writes zoho-deals.json, zoho-accounts.json, and deals.xlsx to src/data/.
Auto-refreshes access token on each run.
"""

import json
import os
import sys
from datetime import datetime
from difflib import SequenceMatcher

import openpyxl
import requests

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUTH_FILE = os.path.join(PROJECT_ROOT, "auth", "zoho.json")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
MAPPING_FILE = os.path.join(DATA_DIR, "zoho-client-mapping.json")


def load_auth():
    with open(AUTH_FILE, "r") as f:
        return json.load(f)


def save_auth(auth):
    with open(AUTH_FILE, "w") as f:
        json.dump(auth, f, indent=2)


def refresh_access_token(auth):
    url = f"{auth['accounts_url']}/oauth/v2/token"
    params = {
        "refresh_token": auth["refresh_token"],
        "client_id": auth["client_id"],
        "client_secret": auth["client_secret"],
        "grant_type": "refresh_token",
    }
    resp = requests.post(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    if "access_token" not in data:
        print(f"Token refresh failed: {data}")
        sys.exit(1)
    auth["access_token"] = data["access_token"]
    save_auth(auth)
    print(f"Access token refreshed.")
    return auth


def fetch_all_records(auth, module):
    """Fetch all records from a Bigin module with pagination."""
    records = []
    page = 1
    while True:
        url = f"{auth['base_url']}/bigin/v1/{module}"
        headers = {"Authorization": f"Zoho-oauthtoken {auth['access_token']}"}
        params = {"per_page": 200, "page": page}
        resp = requests.get(url, headers=headers, params=params)
        if resp.status_code == 204:
            break
        if resp.status_code == 401:
            print("Token expired, refreshing...")
            auth = refresh_access_token(auth)
            continue
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("data", [])
        if not batch:
            break
        records.extend(batch)
        info = data.get("info", {})
        if not info.get("more_records", False):
            break
        page += 1
    return records, auth


XLSX_COLUMNS = [
    ("Deal Name", "Deal_Name"),
    ("Account Name", "Account_Name"),
    ("Amount", "Amount"),
    ("Stage", "Stage"),
    ("Pipeline", "Pipeline"),
    ("Closing Date", "Closing_Date"),
    ("Lead Source", "Lead_Source"),
    ("Region", "Region"),
    ("Type", "Type"),
    ("Owner", "Owner"),
    ("Description", "Description"),
    ("Next Step", "Next_Step"),
    ("Created Time", "Created_Time"),
    ("Modified Time", "Modified_Time"),
]


def _extract_field(deal, api_key):
    """Extract a field value, flattening nested objects like Account_Name.name."""
    val = deal.get(api_key)
    if val is None:
        return ""
    if isinstance(val, dict):
        return val.get("name", "")
    return val


def write_deals_xlsx(deals):
    """Write deals to deals.xlsx with flat columns."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Deals"

    # Header row
    headers = [col[0] for col in XLSX_COLUMNS]
    ws.append(headers)

    # Data rows
    for deal in deals:
        row = [_extract_field(deal, col[1]) for col in XLSX_COLUMNS]
        ws.append(row)

    xlsx_path = os.path.join(DATA_DIR, "deals.xlsx")
    wb.save(xlsx_path)
    print(f"Wrote {xlsx_path} ({len(deals)} rows)")


def main():
    auth = load_auth()
    auth = refresh_access_token(auth)

    print("Fetching Deals...")
    deals, auth = fetch_all_records(auth, "Deals")
    print(f"  Got {len(deals)} deals")

    print("Fetching Accounts...")
    accounts, auth = fetch_all_records(auth, "Accounts")
    print(f"  Got {len(accounts)} accounts")

    os.makedirs(DATA_DIR, exist_ok=True)

    deals_path = os.path.join(DATA_DIR, "zoho-deals.json")
    with open(deals_path, "w") as f:
        json.dump(deals, f, indent=2)
    print(f"Wrote {deals_path}")

    accounts_path = os.path.join(DATA_DIR, "zoho-accounts.json")
    with open(accounts_path, "w") as f:
        json.dump(accounts, f, indent=2)
    print(f"Wrote {accounts_path}")

    # Write deals.xlsx
    write_deals_xlsx(deals)

    # Update mapping file with new accounts
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, "r") as f:
            existing_mapping = json.load(f)
    else:
        existing_mapping = {}

    account_names = sorted(set(
        deal.get("Account_Name", {}).get("name", "")
        for deal in deals
        if deal.get("Account_Name")
    ))

    unmapped = [name for name in account_names if name and name not in existing_mapping]
    if unmapped:
        print(f"\n{len(unmapped)} unmapped accounts found.")

    print(f"\nDone. {len(deals)} deals, {len(accounts)} accounts.")

    from refresh_utils import update_timestamp
    update_timestamp("zoho")


if __name__ == "__main__":
    main()
