from http.server import BaseHTTPRequestHandler, HTTPServer
import time

XML_RESPONSE = b"""<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
 <BODY>
  <DATA>
   <TALLYMESSAGE>
    <VOUCHER>
     <DATE>20231015</DATE>
     <VOUCHERNUMBER>VCH-001</VOUCHERNUMBER>
     <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
     <NARRATION>Payment for server hosting (Azure)</NARRATION>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Azure Cloud Services</LEDGERNAME>
      <AMOUNT>5000</AMOUNT>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>HDFC Bank</LEDGERNAME>
      <AMOUNT>-5000</AMOUNT>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
   <TALLYMESSAGE>
    <VOUCHER>
     <DATE>20231016</DATE>
     <VOUCHERNUMBER>VCH-002</VOUCHERNUMBER>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <NARRATION>Consulting Revenue</NARRATION>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>HDFC Bank</LEDGERNAME>
      <AMOUNT>25000</AMOUNT>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales</LEDGERNAME>
      <AMOUNT>-25000</AMOUNT>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>
"""

class TallyMockHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Tally accepts POST requests with XML for export
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        print(f"Received POST request with body: {post_data}")
        
        self.send_response(200)
        self.send_header("Content-Type", "text/xml")
        self.end_headers()
        self.wfile.write(XML_RESPONSE)

    def log_message(self, format, *args):
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {self.address_string()} - {format%args}")

if __name__ == "__main__":
    server_address = ('', 9000)
    httpd = HTTPServer(server_address, TallyMockHandler)
    print("Starting Mock Tally Server on port 9000...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    print("Stopping server.")
    httpd.server_close()
