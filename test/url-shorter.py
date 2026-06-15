import json
import hashlib
from datetime import datetime


class URLValidator:
    """Checks if a URL is valid before shortening."""

    def validate(self, url: str) -> bool:
        if not url.startswith("http"):
            return False
        if len(url) < 10:
            return False
        return self.check_length(url)

    def check_length(self, url: str) -> bool:
        return len(url) <= 2048


class URLShortener:
    """Generates short codes from long URLs."""

    def __init__(self, base_url: str = "https://short.ly/"):
        self.base_url = base_url

    def shorten(self, url: str) -> str:
        code = self.generate_code(url)
        return self.base_url + code

    def generate_code(self, url: str) -> str:
        return hashlib.md5(url.encode()).hexdigest()[:6]


class Storage:
    """Stores and retrieves URL mappings."""

    def __init__(self):
        self._store: dict = {}

    def save(self, code: str, original: str) -> None:
        self._store[code] = {
            "url": original,
            "created_at": datetime.now().isoformat(),
            "clicks": 0,
        }

    def get(self, code: str) -> dict:
        return self._store.get(code, {})

    def increment_clicks(self, code: str) -> None:
        if code in self._store:
            self._store[code]["clicks"] += 1

    def export(self) -> str:
        return json.dumps(self._store, indent=2)


class URLService:
    """Orchestrates validation, shortening, and storage."""

    def __init__(self):
        self.validator = URLValidator()
        self.shortener = URLShortener()
        self.storage = Storage()

    def create(self, url: str) -> str:
        if not self.validator.validate(url):
            raise ValueError("Invalid URL")
        short = self.shortener.shorten(url)
        code = self.shortener.generate_code(url)
        self.storage.save(code, url)
        return short

    def visit(self, code: str) -> str:
        data = self.storage.get(code)
        if not data:
            raise KeyError("Short URL not found")
        self.storage.increment_clicks(code)
        return data["url"]

    def stats(self, code: str) -> dict:
        return self.storage.get(code)


if __name__ == "__main__":
    service = URLService()
    short = service.create("https://github.com/vaibhavkothari33/Code-to-Diagram")
    print("Shortened:", short)
    code = short.split("/")[-1]
    print("Redirecting to:", service.visit(code))
    print("Stats:", service.stats(code))