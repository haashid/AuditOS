"""
Tally Prime Connector
- XML Import: parse exported Day Book / Voucher Register XML files
- Live Connector: query Tally's HTTP interface on port 9000 (same network only)

Docs: https://help.tallysolutions.com/integrate-with-tallyprime/
"""
from lxml import etree
import httpx
from datetime import datetime


def parse_tally_xml(xml_content: bytes) -> list:
    """
    Parses a Tally-exported XML file (Day Book or Voucher Register export).
    Tally XML structure: ENVELOPE > BODY > DATA > TALLYMESSAGE > VOUCHER
    Each VOUCHER contains ALLLEDGERENTRIES.LIST with debit/credit lines.
    """
    transactions = []

    try:
        root = etree.fromstring(xml_content)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"Invalid Tally XML format: {e}")

    # Find all VOUCHER elements anywhere in the tree
    vouchers = root.findall(".//VOUCHER")

    for voucher in vouchers:
        voucher_date_raw = voucher.findtext("DATE", "")
        voucher_number = voucher.findtext("VOUCHERNUMBER", "")
        voucher_type = voucher.findtext("VOUCHERTYPENAME", "")
        narration = voucher.findtext("NARRATION", "")

        # Convert Tally date format (YYYYMMDD) to ISO format
        txn_date = None
        if voucher_date_raw and len(voucher_date_raw) == 8:
            try:
                txn_date = datetime.strptime(voucher_date_raw, "%Y%m%d").date().isoformat()
            except ValueError:
                txn_date = None

        # Each voucher has multiple ledger entries (debit/credit lines)
        ledger_entries = voucher.findall(".//ALLLEDGERENTRIES.LIST")

        for entry in ledger_entries:
            ledger_name = entry.findtext("LEDGERNAME", "")
            amount_raw = entry.findtext("AMOUNT", "0")
            is_deemed_positive = entry.findtext("ISDEEMEDPOSITIVE", "No")

            try:
                amount = abs(float(amount_raw))
            except ValueError:
                amount = 0.0

            # In Tally, ISDEEMEDPOSITIVE=Yes typically means a debit entry
            is_debit = is_deemed_positive.strip() == "Yes"

            transactions.append({
                "transaction_date": txn_date,
                "document_number": voucher_number,
                "account_code": "",  # Tally doesn't use numeric account codes by default
                "account_name": ledger_name,
                "debit_amount": amount if is_debit else 0,
                "credit_amount": amount if not is_debit else 0,
                "currency": "INR",
                "description": narration or voucher_type,
                "posted_by": "",  # Tally exports typically don't include user attribution
            })

    if not transactions:
        raise ValueError(
            "No vouchers found in this XML file. "
            "Ensure you exported from Tally using Display > Day Book > Export (XML format)."
        )

    return transactions


def get_export_request_xml(report_name: str = "Day Book",
                            from_date: str = None, to_date: str = None) -> str:
    """
    Generates the XML request body to send to Tally's HTTP interface
    to request an export of the given report.
    """
    date_filter = ""
    if from_date and to_date:
        date_filter = f"""
        <SVFROMDATE>{from_date}</SVFROMDATE>
        <SVTODATE>{to_date}</SVTODATE>"""

    return f"""<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>{report_name}</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{date_filter}
   </STATICVARIABLES>
  </DESC>
 </BODY>
</ENVELOPE>"""


def pull_from_live_tally(tally_url: str, from_date: str = None, to_date: str = None) -> list:
    """
    Live connector: sends an HTTP request to a Tally instance on the
    local network (default port 9000) and parses the XML response.

    tally_url example: "http://192.168.1.100:9000"

    NOTE: This only works if the AuditOS backend can reach the client's
    network. For cloud-hosted AuditOS, this typically requires the
    auditor to run a local agent or VPN.
    """
    request_xml = get_export_request_xml("Day Book", from_date, to_date)

    try:
        response = httpx.post(
            tally_url,
            content=request_xml,
            headers={"Content-Type": "text/xml"},
            timeout=30.0
        )
        response.raise_for_status()
    except httpx.ConnectError:
        raise ConnectionError(
            f"Could not connect to Tally at {tally_url}. "
            f"Ensure Tally is running with ODBC/HTTP enabled (F12 > Configure > "
            f"Data Synchronization) and the AuditOS server can reach this address."
        )

    return parse_tally_xml(response.content)
