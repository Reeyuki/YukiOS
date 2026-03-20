#!/bin/bash
SRC_DIR="$1"
OUTPUT_FILE="$2"
VERSION="$3"

if [ -z "$SRC_DIR" ] || [ -z "$OUTPUT_FILE" ] || [ -z "$VERSION" ]; then
  echo "Usage: $0 <source-dir> <output-json-file> <version>"
  exit 1
fi

OUTPUT_PATH="$(realpath "$OUTPUT_FILE")"

cd "$SRC_DIR" || exit 1

{
  echo "{"
  echo "  \"version\": \"$VERSION\","
  echo "  \"files\": {"

  first=true
  while IFS= read -r file; do
    file="${file#./}"
    if [[ "$file" == .* ]]; then
      continue
    fi
    if [ "$first" = true ]; then
      first=false
    else
      echo ","
    fi
    echo -n "    \"$file\": { \"path\": \"$file\" }"
  done < <(find . -type f ! -path "*/icons/*" ! -path "*/wallpapers/*" | sort)

  echo
  echo "  }"
  echo "}"
} > "$OUTPUT_PATH"
