import zipfile, os, json

with open("manifest.json") as f:
    version = json.load(f)["version"]

os.makedirs("dist", exist_ok=True)
zip_path = f"dist/jobtint-v{version}.zip"

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for f in ["manifest.json", "content.js", "styles.css"]:
        z.write(f)
    for folder in ["popup", "icons"]:
        for root, _, files in os.walk(folder):
            for file in files:
                z.write(os.path.join(root, file))

print(f"Done -> {zip_path}")
