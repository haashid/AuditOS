import os
from PIL import Image, ImageDraw, ImageFont

img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "invoice_JE_005.png")

def create_invoice_image():
    # Create white canvas
    img = Image.new('RGB', (800, 1000), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Very basic "fonts" by using default or basic text
    # Since we can't easily guarantee system fonts, we'll just draw basic shapes and text
    
    # Title
    draw.text((50, 50), "INVOICE", fill=(0,0,0), font_size=40)
    
    # Header Line
    draw.line((50, 100, 750, 100), fill=(0,0,0), width=2)
    
    # Vendor
    draw.text((50, 120), "FROM:", fill=(0,0,0), font_size=16)
    draw.text((50, 140), "Global Tech Solutions LLC", fill=(0,0,0), font_size=24)
    draw.text((50, 170), "456 Enterprise Way, Suite 200", fill=(0,0,0), font_size=16)
    draw.text((50, 190), "San Francisco, CA 94105", fill=(0,0,0), font_size=16)
    
    # Client
    draw.text((450, 120), "TO:", fill=(0,0,0), font_size=16)
    draw.text((450, 140), "Acme Corporation", fill=(0,0,0), font_size=24)
    draw.text((450, 170), "100 Main Street", fill=(0,0,0), font_size=16)
    draw.text((450, 190), "New York, NY 10001", fill=(0,0,0), font_size=16)
    
    # Details
    draw.text((50, 260), "Invoice Number: INV-2024-8842", fill=(0,0,0), font_size=20)
    draw.text((50, 290), "Date: January 25, 2024", fill=(0,0,0), font_size=20)
    draw.text((50, 320), "Due Date: February 9, 2024", fill=(0,0,0), font_size=20)
    
    # Table Header
    draw.rectangle((50, 380, 750, 420), fill=(240, 240, 240))
    draw.text((70, 390), "Description", fill=(0,0,0), font_size=18)
    draw.text((600, 390), "Amount (USD)", fill=(0,0,0), font_size=18)
    
    # Items
    draw.text((70, 450), "Software Licensing and Enterprise Support (Q1)", fill=(0,0,0), font_size=18)
    draw.text((600, 450), "$150,000.00", fill=(0,0,0), font_size=18)
    
    draw.text((70, 500), "Implementation Services & Custom Dev", fill=(0,0,0), font_size=18)
    draw.text((600, 500), "$50,000.00", fill=(0,0,0), font_size=18)
    
    draw.line((50, 550, 750, 550), fill=(0,0,0), width=1)
    
    # Totals
    draw.text((400, 600), "TOTAL AMOUNT DUE:", fill=(0,0,0), font_size=24)
    draw.text((600, 600), "$200,000.00", fill=(200,0,0), font_size=24)
    
    # Footer
    draw.text((50, 900), "Please make checks payable to Global Tech Solutions LLC.", fill=(100,100,100), font_size=14)
    draw.text((50, 920), "If you have any questions, contact billing@globaltech.example.com", fill=(100,100,100), font_size=14)
    
    img.save(img_path)
    print(f"Successfully generated invoice image at {img_path}")

if __name__ == "__main__":
    create_invoice_image()
