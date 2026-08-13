import os
import json
import base64
import hashlib
from typing import Dict, Optional, List, Tuple
import google.generativeai as genai
from pdf2image import convert_from_path
from PIL import Image
import io
from dotenv import load_dotenv

load_dotenv()

# Poppler path for Windows - set POPPLER_PATH in .env if poppler is not in system PATH
# e.g. POPPLER_PATH=C:\poppler\Library\bin
POPPLER_PATH = os.getenv("POPPLER_PATH") or None

# Expense categories for smart categorization
EXPENSE_CATEGORIES = [
    "Utilities",
    "Office Supplies",
    "Software & Subscriptions",
    "Professional Services",
    "Travel & Transportation",
    "Meals & Entertainment",
    "Rent & Lease",
    "Insurance",
    "Marketing & Advertising",
    "Equipment & Machinery",
    "Raw Materials",
    "Shipping & Logistics",
    "Maintenance & Repairs",
    "Telecommunications",
    "Other"
]

EXTRACTION_PROMPT = """You are an advanced invoice data extraction system with multi-language support. Analyze this invoice image and extract structured data with confidence scoring.

IMPORTANT: This invoice may be in ANY language (English, Spanish, French, German, Chinese, Japanese, Arabic, etc.). Extract and translate all field values to English where appropriate, but preserve original text for names and addresses.

Return ONLY valid JSON with no additional text, markdown formatting, or code blocks.

Required format:
{
  "invoice_number": "",
  "date": "",
  "due_date": "",
  "vendor_name": "",
  "vendor_address": "",
  "vendor_email": "",
  "vendor_phone": "",
  "vendor_tax_id": "",
  "customer_name": "",
  "customer_address": "",
  "currency": "",
  "subtotal": 0.0,
  "tax": 0.0,
  "tax_rate": 0.0,
  "total_amount": 0.0,
  "amount_paid": 0.0,
  "amount_due": 0.0,
  "line_items": [
    {
      "description": "",
      "quantity": 0,
      "unit_price": 0.0,
      "total_price": 0.0
    }
  ],
  "payment_terms": "",
  "payment_method": "",
  "bank_details": "",
  "po_number": "",
  "metadata": "",
  "extra_information": "",
  "detected_language": "",
  "expense_category": "",
  "confidence_scores": {
    "invoice_number": 0.0,
    "date": 0.0,
    "vendor_name": 0.0,
    "total_amount": 0.0,
    "line_items": 0.0,
    "overall": 0.0
  }
}

Field descriptions:
- detected_language: The primary language of the invoice (e.g., "English", "Spanish", "French", "German", "Chinese", "Japanese")
- expense_category: Categorize this invoice into ONE of these categories: """ + str(EXPENSE_CATEGORIES) + """
- confidence_scores: For each field, provide a confidence score from 0.0 to 1.0 indicating how certain you are about the extraction. The "overall" score is the average confidence.
- metadata: Extract any additional invoice details like reference numbers, contract IDs, etc.
- extra_information: Extract any other notes, special instructions, delivery information, warranty details, or miscellaneous text found on the invoice.

CONFIDENCE SCORING GUIDELINES:
- 1.0: Text is clearly visible and unambiguous
- 0.8-0.9: Text is readable with high confidence
- 0.6-0.7: Text is partially obscured or ambiguous
- 0.4-0.5: Text is difficult to read, making educated guess
- 0.0-0.3: Text is missing or unreadable

Extract all visible information accurately. If a field is not present, use empty string for text fields and 0 for numeric fields.
Ensure the JSON is properly formatted and parseable."""

class GeminiService:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Gemini service with API key
        
        Args:
            api_key: Gemini API key. If not provided, will try to get from environment.
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        self._configured = False
    
    def configure(self, api_key: Optional[str] = None):
        """Configure the Gemini API with the provided key"""
        key_to_use = api_key or self.api_key
        
        if not key_to_use:
            raise Exception("No Gemini API key provided. Please set your API key in Settings.")
        
        genai.configure(api_key=key_to_use)
        self._configured = True
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the best available Gemini model"""
        try:
            print("Listing available Gemini models...")
            available_models = []
            for model in genai.list_models():
                if 'generateContent' in model.supported_generation_methods:
                    available_models.append(model.name)
                    print(f"  - {model.name}")
            
            # Try models in order of preference (Flash models have higher free quotas)
            preferred_models = [
                'models/gemini-2.5-flash',  # Best free tier quotas
                'models/gemini-2.0-flash',
                'models/gemini-flash-latest',
                'models/gemini-2.5-pro',
                'models/gemini-1.5-flash-latest', 
                'models/gemini-1.5-flash',
                'models/gemini-1.5-pro-latest',
                'models/gemini-1.5-pro',
                'models/gemini-pro-vision',
                'models/gemini-pro'
            ]
            
            model_to_use = None
            for preferred in preferred_models:
                if preferred in available_models:
                    model_to_use = preferred.replace('models/', '')
                    break
            
            if not model_to_use:
                # Use the first available model
                model_to_use = available_models[0].replace('models/', '') if available_models else 'gemini-pro-vision'
            
            print(f"Using model: {model_to_use}")
            self.model = genai.GenerativeModel(model_to_use)
            
        except Exception as e:
            print(f"Error listing models: {e}")
            # Fallback to gemini-pro-vision
            print("Falling back to gemini-pro-vision")
            self.model = genai.GenerativeModel('gemini-pro-vision')
    
    def pdf_to_images(self, pdf_path: str, max_pages: int = 3) -> list:
        """Convert PDF to images
        
        Args:
            pdf_path: Path to PDF file
            max_pages: Maximum number of pages to convert (default 3)
            
        Returns:
            List of PIL Image objects
        """
        try:
            # Convert PDF to images
            images = convert_from_path(
                pdf_path,
                dpi=200,
                first_page=1,
                last_page=max_pages,
                poppler_path=os.getenv("POPPLER_PATH") or None,
            )
            return images
        except Exception as e:
            raise Exception(f"Error converting PDF to images: {str(e)}")
    
    def extract_invoice_data(self, pdf_path: str, api_key: Optional[str] = None) -> Dict:
        """Extract invoice data from PDF using Gemini Vision
        
        Args:
            pdf_path: Path to PDF file
            api_key: Optional API key to use for this extraction
            
        Returns:
            Dictionary containing extracted invoice data
        """
        # Configure with provided key or existing key
        if api_key:
            self.configure(api_key)
        elif not self._configured:
            self.configure()
        
        if not self.model:
            raise Exception("Gemini model not initialized. Please check your API key.")
        
        try:
            # Convert PDF to images
            images = self.pdf_to_images(pdf_path)
            
            if not images:
                raise Exception("No images generated from PDF")
            
            # Use the first page (most invoices are 1-2 pages)
            first_image = images[0]
            
            # Generate content with Gemini Vision
            response = self.model.generate_content([
                EXTRACTION_PROMPT,
                first_image
            ])
            
            # Extract text from response
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            
            # Parse JSON
            try:
                extracted_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                # If JSON parsing fails, try to extract JSON from the response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    extracted_data = json.loads(json_match.group())
                else:
                    raise Exception(f"Failed to parse JSON response: {str(e)}")
            
            return extracted_data
            
        except Exception as e:
            raise Exception(f"Error extracting invoice data: {str(e)}")
    
    def validate_extraction(self, data: Dict) -> bool:
        """Validate extracted data structure
        
        Args:
            data: Extracted invoice data
            
        Returns:
            True if valid, False otherwise
        """
        required_fields = [
            "invoice_number", "date", "vendor_name", "vendor_address",
            "customer_name", "customer_address", "currency", 
            "subtotal", "tax", "total_amount", "line_items",
            "metadata", "extra_information"
        ]
        
        # Check if all required fields exist
        for field in required_fields:
            if field not in data:
                return False
        
        # Check line items structure
        if not isinstance(data["line_items"], list):
            return False
        
        for item in data["line_items"]:
            if not all(k in item for k in ["description", "quantity", "unit_price", "total_price"]):
                return False
        
        return True

    def extract_from_image(self, image_path: str, api_key: Optional[str] = None) -> Dict:
        """Extract invoice data from an image file (JPG, PNG, etc.)
        
        Args:
            image_path: Path to image file
            api_key: Optional API key to use for this extraction
            
        Returns:
            Dictionary containing extracted invoice data
        """
        # Configure with provided key or existing key
        if api_key:
            self.configure(api_key)
        elif not self._configured:
            self.configure()
        
        if not self.model:
            raise Exception("Gemini model not initialized. Please check your API key.")
        
        try:
            # Load image directly
            image = Image.open(image_path)
            
            # Generate content with Gemini Vision
            response = self.model.generate_content([
                EXTRACTION_PROMPT,
                image
            ])
            
            # Extract and parse response
            return self._parse_response(response.text)
            
        except Exception as e:
            raise Exception(f"Error extracting invoice data from image: {str(e)}")

    def _parse_response(self, response_text: str) -> Dict:
        """Parse Gemini response text to extract JSON
        
        Args:
            response_text: Raw response text from Gemini
            
        Returns:
            Parsed dictionary
        """
        response_text = response_text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Parse JSON
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            # If JSON parsing fails, try to extract JSON from the response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                raise Exception(f"Failed to parse JSON response: {str(e)}")

    def compute_invoice_hash(self, extracted_data: Dict) -> str:
        """Compute a hash for duplicate detection
        
        Uses invoice number, vendor name, date, and total amount to create a fingerprint.
        
        Args:
            extracted_data: Extracted invoice data
            
        Returns:
            SHA256 hash string
        """
        # Normalize values for comparison
        invoice_number = str(extracted_data.get("invoice_number", "")).strip().lower()
        vendor_name = str(extracted_data.get("vendor_name", "")).strip().lower()
        date = str(extracted_data.get("date", "")).strip()
        total = str(extracted_data.get("total_amount", 0))
        
        # Create composite key
        composite = f"{invoice_number}|{vendor_name}|{date}|{total}"
        
        return hashlib.sha256(composite.encode()).hexdigest()

    def check_duplicate(
        self, 
        extracted_data: Dict, 
        existing_invoices: List[Dict]
    ) -> Tuple[bool, Optional[int], float]:
        """Check if an invoice is a duplicate of existing ones
        
        Args:
            extracted_data: Newly extracted invoice data
            existing_invoices: List of existing invoice data dicts with 'id' and 'data' keys
            
        Returns:
            Tuple of (is_duplicate, duplicate_of_id, similarity_score)
        """
        new_hash = self.compute_invoice_hash(extracted_data)
        new_invoice_num = str(extracted_data.get("invoice_number", "")).strip().lower()
        new_vendor = str(extracted_data.get("vendor_name", "")).strip().lower()
        new_total = float(extracted_data.get("total_amount", 0) or 0)
        new_date = str(extracted_data.get("date", "")).strip()
        
        for existing in existing_invoices:
            existing_data = existing.get("data", {})
            existing_id = existing.get("id")
            
            if not existing_data:
                continue
            
            # Exact hash match
            existing_hash = self.compute_invoice_hash(existing_data)
            if new_hash == existing_hash:
                return (True, existing_id, 1.0)
            
            # Check for similar invoice
            existing_invoice_num = str(existing_data.get("invoice_number", "")).strip().lower()
            existing_vendor = str(existing_data.get("vendor_name", "")).strip().lower()
            existing_total = float(existing_data.get("total_amount", 0) or 0)
            existing_date = str(existing_data.get("date", "")).strip()
            
            similarity_score = 0.0
            
            # Invoice number match (high weight)
            if new_invoice_num and existing_invoice_num:
                if new_invoice_num == existing_invoice_num:
                    similarity_score += 0.4
                elif new_invoice_num in existing_invoice_num or existing_invoice_num in new_invoice_num:
                    similarity_score += 0.2
            
            # Vendor name match
            if new_vendor and existing_vendor:
                if new_vendor == existing_vendor:
                    similarity_score += 0.25
                elif self._fuzzy_match(new_vendor, existing_vendor):
                    similarity_score += 0.15
            
            # Total amount match
            if new_total > 0 and existing_total > 0:
                if abs(new_total - existing_total) < 0.01:
                    similarity_score += 0.25
            
            # Date match
            if new_date and existing_date and new_date == existing_date:
                similarity_score += 0.1
            
            # If similarity is high enough, consider it a duplicate
            if similarity_score >= 0.65:
                return (True, existing_id, similarity_score)
        
        return (False, None, 0.0)

    def _fuzzy_match(self, str1: str, str2: str, threshold: float = 0.8) -> bool:
        """Simple fuzzy string matching
        
        Args:
            str1: First string
            str2: Second string
            threshold: Similarity threshold (0-1)
            
        Returns:
            True if strings are similar enough
        """
        if not str1 or not str2:
            return False
        
        # Simple character-based similarity
        str1 = str1.lower().replace(" ", "")
        str2 = str2.lower().replace(" ", "")
        
        if str1 == str2:
            return True
        
        # Check if one contains the other
        if str1 in str2 or str2 in str1:
            return True
        
        # Calculate Jaccard similarity on character n-grams
        def get_ngrams(s, n=2):
            return set(s[i:i+n] for i in range(len(s) - n + 1))
        
        ngrams1 = get_ngrams(str1)
        ngrams2 = get_ngrams(str2)
        
        if not ngrams1 or not ngrams2:
            return False
        
        intersection = len(ngrams1 & ngrams2)
        union = len(ngrams1 | ngrams2)
        
        return (intersection / union) >= threshold if union > 0 else False

    def normalize_vendor_name(self, vendor_name: str) -> str:
        """Normalize vendor name for matching
        
        Args:
            vendor_name: Raw vendor name
            
        Returns:
            Normalized vendor name
        """
        if not vendor_name:
            return ""
        
        # Convert to lowercase
        normalized = vendor_name.lower().strip()
        
        # Remove common suffixes
        suffixes = [
            " inc.", " inc", " llc", " ltd", " ltd.", " limited",
            " corp", " corp.", " corporation", " co.", " co",
            " gmbh", " ag", " sa", " srl", " pty", " plc"
        ]
        for suffix in suffixes:
            if normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)]
        
        # Remove extra whitespace
        normalized = " ".join(normalized.split())
        
        return normalized

    def translate_invoice_data(
        self, 
        invoice_data: Dict, 
        target_language: str
    ) -> Dict:
        """Translate invoice data to a target language
        
        Args:
            invoice_data: Invoice data dictionary to translate
            target_language: Target language (e.g., "Spanish", "French", "German", etc.)
            
        Returns:
            Translated invoice data dictionary
        """
        if not self._configured:
            self.configure()
        
        if not self.model:
            raise Exception("Gemini model not initialized")
        
        # Prepare the prompt for translation
        prompt = f"""Translate the following invoice data to {target_language}. 
Keep the JSON structure exactly the same, only translate the text values.
Do NOT translate:
- Numbers (amounts, quantities, prices)
- Dates (keep original format)
- Invoice numbers
- Currency codes
- Email addresses
- Phone numbers
- URLs

Only translate:
- Vendor names (if they have a common translation)
- Customer names (if they have a common translation)
- Addresses (translate city/country names, keep street numbers)
- Item descriptions
- Payment terms
- Any other text content

Return ONLY valid JSON, no markdown, no explanation.

Invoice Data:
{json.dumps(invoice_data, indent=2, ensure_ascii=False)}

Translated JSON:"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean up the response
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            
            translated_data = json.loads(result_text.strip())
            return translated_data
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing error in translation: {e}")
            raise Exception(f"Failed to parse translated data: {str(e)}")
        except Exception as e:
            print(f"Translation error: {e}")
            raise Exception(f"Translation failed: {str(e)}")


def get_gemini_service(api_key: Optional[str] = None) -> GeminiService:
    """Factory function to create a GeminiService instance"""
    return GeminiService(api_key)
