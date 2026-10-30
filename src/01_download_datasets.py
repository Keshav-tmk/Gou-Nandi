from __future__ import annotations
import io, json, shutil, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "data" / "external"
DOWNLOADS = ROOT / "data" / "downloads"
EXT.mkdir(parents=True, exist_ok=True)
DOWNLOADS.mkdir(parents=True, exist_ok=True)

REPOSITORIES = {
    "bovheat": "https://api.github.com/repos/bovheat/bovheat",
    "db-cow-mounts": "https://api.github.com/repos/WASP-lab/db-cow-mounts",
    "db-cow-walking": "https://api.github.com/repos/WASP-lab/db-cow-walking",
}

def request_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "smart-livestock-ai-dataset-fetcher/1.0",
                                                "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.read()

def download_to(url: str, destination: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "smart-livestock-ai-dataset-fetcher/1.0"})
    with urllib.request.urlopen(req, timeout=180) as response, destination.open("wb") as out:
        shutil.copyfileobj(response, out)

def safe_extract(zip_path: Path, target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        base = target_dir.resolve()
        for member in zf.infolist():
            destination = (target_dir / member.filename).resolve()
            if destination != base and base not in destination.parents:
                raise ValueError(f"Unsafe archive path: {member.filename}")
        zf.extractall(target_dir)

def main():
    for name, api_url in REPOSITORIES.items():
        print(f"\n[{name}] Looking up public repository metadata...")
        try:
            metadata = json.loads(request_bytes(api_url).decode("utf-8"))
            branch = metadata.get("default_branch", "main")
            archive_url = f"https://codeload.github.com/{metadata['full_name']}/zip/refs/heads/{branch}"
            archive_path = DOWNLOADS / f"{name}.zip"
            print(f"Downloading branch '{branch}' from {metadata['html_url']}")
            download_to(archive_url, archive_path)
            target = EXT / name
            if target.exists():
                shutil.rmtree(target)
            safe_extract(archive_path, target)
            print(f"Extracted to: {target}")
            print(f"Archive size: {archive_path.stat().st_size / (1024*1024):.1f} MB")
        except Exception as exc:
            print(f"WARNING: Could not download {name}: {exc}")
            print("Check your internet connection, repository availability, and disk space.")
    print("\nDone. Next run: python src/02_inspect_datasets.py")
    print("CowScreeningDB is NOT downloaded here because its dataset requires a separate license/password process.")

if __name__ == "__main__":
    main()
