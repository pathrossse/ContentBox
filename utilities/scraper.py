import requests
from bs4 import BeautifulSoup
import urllib.parse
from typing import Optional

def is_valid_url(url: str) -> bool:
    """Check if the given string is a valid URL."""
    try:
        result = urllib.parse.urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False

def scrape_url(url: str) -> Optional[str]:
    """
    Fetches the HTML content of a URL and extracts readable text.
    Returns None if the fetch fails.
    """
    if not is_valid_url(url):
        return None

    try:
        # User-Agent headers to avoid basic anti-scraping blocks
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove noisy elements
        for script_or_style in soup(["script", "style", "header", "footer", "nav", "aside"]):
            script_or_style.decompose()
            
        # Get text
        text = soup.get_text(separator=' ', strip=True)
        # Clean up multiple spaces
        text = ' '.join(text.split())
        return text
        
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None
