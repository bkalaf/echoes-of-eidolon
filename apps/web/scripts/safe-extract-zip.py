#!/usr/bin/env python3
"""Bounded ZIP extraction for managed-asset source packages."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

MAX_FILES = 512
MAX_MEMBER_BYTES = 512 * 1024 * 1024
MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100


def fail(message: str) -> None:
    raise SystemExit(f"unsafe ZIP: {message}")


def main() -> None:
    if len(sys.argv) < 4:
        fail("usage: safe-extract-zip.py ARCHIVE DESTINATION EXPECTED_MEMBER...")
    archive_path = Path(sys.argv[1]).resolve(strict=True)
    destination = Path(sys.argv[2]).resolve()
    expected = set(sys.argv[3:])
    destination.mkdir(parents=True, exist_ok=False)

    inventory: list[dict[str, object]] = []
    seen: set[str] = set()
    total_bytes = 0
    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        if len(members) > MAX_FILES:
            fail(f"file count {len(members)} exceeds {MAX_FILES}")
        names = {member.filename for member in members if not member.is_dir()}
        if names != expected:
            missing = sorted(expected - names)
            extra = sorted(names - expected)
            fail(f"package inventory mismatch; missing={missing}, extra={extra}")

        for member in members:
            name = member.filename
            path = PurePosixPath(name)
            if not name or "\\" in name or path.is_absolute() or ".." in path.parts:
                fail(f"invalid member path {name!r}")
            folded = "/".join(part.casefold() for part in path.parts)
            if folded in seen:
                fail(f"duplicate or case-colliding member path {name!r}")
            seen.add(folded)
            if member.flag_bits & 0x1:
                fail(f"encrypted member {name!r}")

            unix_mode = member.external_attr >> 16
            file_type = stat.S_IFMT(unix_mode)
            if file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
                fail(f"non-regular member {name!r}")
            if member.file_size > MAX_MEMBER_BYTES:
                fail(f"member {name!r} exceeds the per-file size limit")
            total_bytes += member.file_size
            if total_bytes > MAX_TOTAL_BYTES:
                fail("total uncompressed size exceeds the archive limit")
            if member.compress_size == 0 and member.file_size > 0:
                fail(f"member {name!r} has an invalid zero compressed size")
            if member.compress_size and member.file_size / member.compress_size > MAX_COMPRESSION_RATIO:
                fail(f"member {name!r} exceeds the compression-ratio limit")

        for member in members:
            target = destination.joinpath(*PurePosixPath(member.filename).parts)
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            byte_size = 0
            with archive.open(member, "r") as source, target.open("xb") as output:
                while chunk := source.read(1024 * 1024):
                    digest.update(chunk)
                    output.write(chunk)
                    byte_size += len(chunk)
            if byte_size != member.file_size:
                fail(f"member {member.filename!r} extracted with the wrong byte size")
            inventory.append({
                "path": member.filename,
                "byteSize": byte_size,
                "compressedByteSize": member.compress_size,
                "sha256": digest.hexdigest(),
            })

    inventory_path = destination / ".safe-extraction-inventory.json"
    inventory_path.write_text(json.dumps({
        "archive": archive_path.name,
        "entryCount": len(inventory),
        "totalUncompressedBytes": total_bytes,
        "entries": inventory,
    }, indent=2) + "\n", encoding="utf-8")
    print(inventory_path)


if __name__ == "__main__":
    main()
