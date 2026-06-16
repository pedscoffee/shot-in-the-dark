"""
SmartChart — update_csp_hashes.py
----------------------------------
Run this script any time you edit index.html to keep the
Content Security Policy hashes in sync with your changes.

Usage:
    python3 update_csp_hashes.py
    (run from the same folder as index.html)
"""

import re
import hashlib
import base64
import os
import shutil
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
INPUT_FILE  = "index.html"
BACKUP_EXT  = ".bak"   # set to None to skip backups
# ──────────────────────────────────────────────────────────────────────────────

def csp_hash(text):
    """Return a CSP-ready sha256 hash string for the given text."""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return "'sha256-" + base64.b64encode(digest).decode() + "'"

def main():
    # 1. Check the file exists
    if not os.path.exists(INPUT_FILE):
        print(f"ERROR: '{INPUT_FILE}' not found.")
        print(f"Make sure you run this script from the same folder as {INPUT_FILE}.")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        html = f.read()

    # 2. Optionally back up the original
    if BACKUP_EXT:
        backup_name = INPUT_FILE + BACKUP_EXT
        shutil.copy2(INPUT_FILE, backup_name)
        print(f"Backup saved: {backup_name}")

    # 3. Extract and hash the <style> block
    style_match = re.search(r"<style>(.*?)</style>", html, re.DOTALL)
    if not style_match:
        print("ERROR: No <style> block found in the file.")
        return
    style_hash = csp_hash(style_match.group(1))

    # 4. Extract and hash each inline <script> block (skip src= ones)
    inline_scripts = re.findall(
        r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.DOTALL
    )
    if not inline_scripts:
        print("ERROR: No inline <script> blocks found.")
        return
    script_hashes = [csp_hash(s) for s in inline_scripts]

    # 5. Build the new CSP value
    script_src = "'self' " + " ".join(script_hashes) + " https://cdnjs.cloudflare.com"
    style_src  = style_hash + " https://fonts.googleapis.com"

    new_csp = (
        f"default-src 'self'; "
        f"script-src {script_src}; "
        f"style-src {style_src}; "
        f"font-src 'self' https://fonts.gstatic.com; "
        f"worker-src 'self'; "
        f"object-src 'none'; "
        f"base-uri 'self';"
    )

    # 6. Replace the existing CSP meta tag content
    csp_pattern = re.compile(
        r'(<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]+content=")[^"]*(")',
        re.DOTALL
    )
    new_html, count = csp_pattern.subn(
        lambda m: m.group(1) + new_csp + m.group(2),
        html
    )

    if count == 0:
        print("ERROR: Could not find the Content-Security-Policy meta tag.")
        print("Make sure your index.html has a <meta http-equiv=\"Content-Security-Policy\" ...> tag.")
        return

    # 7. Write the updated file
    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        f.write(new_html)

    # 8. Report results
    print(f"\nDone! Updated {INPUT_FILE}")
    print(f"\n  Style hash   : {style_hash}")
    print(f"  Script hashes: {len(script_hashes)} block(s)")
    for i, h in enumerate(script_hashes, 1):
        print(f"    Block {i}: {h}")
    print(f"\nNew CSP written:")
    print(f"  {new_csp}")

if __name__ == "__main__":
    main()
