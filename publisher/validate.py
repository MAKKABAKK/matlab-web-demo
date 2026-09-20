"""Source-folder validation used by the deterministic Cloud Publisher."""

from __future__ import annotations

import binascii
import hashlib
import re
import struct
import unicodedata
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple


PROJECT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
H1_PATTERN = re.compile(r"^[ \t]{0,3}#[ \t]+(.+?)[ \t]*$", re.MULTILINE)
FENCE_PATTERN = re.compile(r"^[ \t]{0,3}(```+|~~~+)")


class PublisherError(ValueError):
    """A clear, user-actionable publishing validation failure."""


@dataclass(frozen=True)
class ImageInfo:
    format: str
    width: int
    height: int


@dataclass(frozen=True)
class SourceProject:
    project_id: str
    title: str
    description: str
    directory: Path
    readme: Path
    code_files: Tuple[Path, ...]
    image_files: Tuple[Path, ...]
    image_info: Dict[str, ImageInfo]


def validate_project_id(project_id: str) -> None:
    if not PROJECT_ID_PATTERN.fullmatch(project_id):
        raise PublisherError(
            "Project folder name must be lowercase ASCII kebab-case: "
            "letters, numbers, and single hyphens only."
        )


def natural_sort_key(value: str) -> Tuple[Tuple[int, object], ...]:
    """Return a deterministic, case-insensitive key with numeric runs sorted numerically."""
    normalized = unicodedata.normalize("NFC", value).casefold()
    parts = re.split(r"(\d+)", normalized)
    key: List[Tuple[int, object]] = []
    for part in parts:
        if not part:
            continue
        key.append((1, int(part)) if part.isdigit() else (0, part))
    key.append((2, unicodedata.normalize("NFC", value)))
    return tuple(key)


def parse_readme(readme: Path) -> Tuple[str, str]:
    if not readme.is_file() or readme.is_symlink():
        raise PublisherError("README.md is required and must be a regular file.")
    try:
        source = readme.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError as error:
        raise PublisherError("README.md must be valid UTF-8 text.") from error

    lines = source.splitlines()
    fence = None
    heading_index = None
    title = ""
    for index, line in enumerate(lines):
        fence_match = FENCE_PATTERN.match(line)
        if fence_match:
            marker = fence_match.group(1)[0]
            if fence is None:
                fence = marker
            elif fence == marker:
                fence = None
            continue
        if fence is not None:
            continue
        heading = H1_PATTERN.match(line)
        if heading and not line.lstrip().startswith("##"):
            title = re.sub(r"[ \t]+#+[ \t]*$", "", heading.group(1)).strip()
            heading_index = index
            break

    if heading_index is None or not title:
        raise PublisherError("README.md must contain a non-empty '# Project Name' heading.")

    description = " ".join("\n".join(lines[heading_index + 1 :]).split())
    return title, description


def _png_info(data: bytes) -> ImageInfo:
    signature = b"\x89PNG\r\n\x1a\n"
    if not data.startswith(signature):
        raise PublisherError("PNG signature is invalid.")

    position = len(signature)
    width = height = 0
    saw_header = False
    image_data = bytearray()
    saw_end = False
    while position < len(data):
        if position + 12 > len(data):
            raise PublisherError("PNG chunk is truncated.")
        length = struct.unpack(">I", data[position : position + 4])[0]
        chunk_type = data[position + 4 : position + 8]
        chunk_end = position + 12 + length
        if chunk_end > len(data):
            raise PublisherError("PNG chunk length exceeds the file size.")
        chunk_data = data[position + 8 : position + 8 + length]
        expected_crc = struct.unpack(">I", data[position + 8 + length : chunk_end])[0]
        actual_crc = binascii.crc32(chunk_type + chunk_data) & 0xFFFFFFFF
        if expected_crc != actual_crc:
            raise PublisherError("PNG chunk checksum is invalid.")
        if chunk_type == b"IHDR":
            if saw_header or length != 13 or position != len(signature):
                raise PublisherError("PNG IHDR chunk is invalid.")
            width, height = struct.unpack(">II", chunk_data[:8])
            saw_header = True
        if chunk_type == b"IDAT":
            if not saw_header:
                raise PublisherError("PNG IDAT appears before IHDR.")
            image_data.extend(chunk_data)
        if chunk_type == b"IEND":
            if length != 0 or chunk_end != len(data):
                raise PublisherError("PNG IEND chunk is invalid.")
            saw_end = True
            break
        position = chunk_end

    if not saw_header or not image_data or not saw_end or width <= 0 or height <= 0:
        raise PublisherError("PNG is missing valid dimensions or an end marker.")
    try:
        decompressed = zlib.decompress(bytes(image_data))
    except zlib.error as error:
        raise PublisherError("PNG image data is corrupt.") from error
    if not decompressed:
        raise PublisherError("PNG image data is empty.")
    return ImageInfo("png", width, height)


def _jpeg_info(data: bytes) -> ImageInfo:
    if len(data) < 4 or not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise PublisherError("JPEG start or end signature is invalid.")

    standalone = {0x01, *range(0xD0, 0xD8)}
    start_of_frame = {
        0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
        0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
    }
    position = 2
    width = height = 0
    while position < len(data) - 2:
        if data[position] != 0xFF:
            raise PublisherError("JPEG marker stream is invalid.")
        while position < len(data) and data[position] == 0xFF:
            position += 1
        if position >= len(data):
            break
        marker = data[position]
        position += 1
        if marker == 0xD9:
            break
        if marker in standalone:
            continue
        if position + 2 > len(data):
            raise PublisherError("JPEG segment is truncated.")
        segment_length = struct.unpack(">H", data[position : position + 2])[0]
        if segment_length < 2 or position + segment_length > len(data):
            raise PublisherError("JPEG segment length is invalid.")
        if marker in start_of_frame:
            if segment_length < 7:
                raise PublisherError("JPEG frame header is invalid.")
            height, width = struct.unpack(">HH", data[position + 3 : position + 7])
        if marker == 0xDA:
            break
        position += segment_length

    if width <= 0 or height <= 0:
        raise PublisherError("JPEG is missing a supported frame with valid dimensions.")
    return ImageInfo("jpeg", width, height)


def inspect_image(path: Path) -> ImageInfo:
    if not path.is_file() or path.is_symlink():
        raise PublisherError("Image must be a regular file: %s" % path.name)
    data = path.read_bytes()
    if not data:
        raise PublisherError("Image is empty: %s" % path.name)

    extension = path.suffix.lower()
    try:
        info = _png_info(data) if extension == ".png" else _jpeg_info(data)
    except PublisherError as error:
        raise PublisherError("Invalid image %s: %s" % (path.name, error)) from error
    expected = "png" if extension == ".png" else "jpeg"
    if info.format != expected:
        raise PublisherError("Image extension does not match its signature: %s" % path.name)
    return info


def label_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    words = re.sub(r"[_-]+", " ", stem)
    words = " ".join(words.split()).lower()
    if not words:
        return "Image"
    return words[0].upper() + words[1:]


def artifact_id(prefix: str, filename: str, used_ids: Iterable[str]) -> str:
    stem = unicodedata.normalize("NFKD", Path(filename).stem)
    ascii_stem = stem.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_stem).strip("-") or "file"
    candidate = "%s-%s" % (prefix, slug)
    used = set(used_ids)
    if candidate in used:
        digest = hashlib.sha256(filename.encode("utf-8")).hexdigest()[:8]
        candidate = "%s-%s" % (candidate, digest)
    suffix = 2
    unique_candidate = candidate
    while unique_candidate in used:
        unique_candidate = "%s-%d" % (candidate, suffix)
        suffix += 1
    return unique_candidate


def _validate_source_code(path: Path) -> None:
    if not path.is_file() or path.is_symlink():
        raise PublisherError("MATLAB source must be a regular file: %s" % path.name)
    try:
        source = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError as error:
        raise PublisherError("MATLAB source must be valid UTF-8: %s" % path.name) from error
    if not source.strip():
        raise PublisherError("MATLAB source is empty: %s" % path.name)


def discover_project(project_directory: Path) -> SourceProject:
    if project_directory.is_symlink() or not project_directory.is_dir():
        raise PublisherError("Project source must be a regular directory: %s" % project_directory.name)
    validate_project_id(project_directory.name)
    title, description = parse_readme(project_directory / "README.md")

    code_files: List[Path] = []
    image_files: List[Path] = []
    seen_names = set()
    for entry in project_directory.iterdir():
        if entry.is_symlink():
            raise PublisherError("Symlinks are not allowed: %s/%s" % (project_directory.name, entry.name))
        if entry.name.startswith(".") or entry.name == "README.md":
            continue
        if entry.is_dir():
            raise PublisherError(
                "Nested directories are not supported in MVP: %s/%s" % (project_directory.name, entry.name)
            )
        if not entry.is_file():
            continue
        extension = entry.suffix.lower()
        if extension not in IMAGE_EXTENSIONS and extension != ".m":
            continue
        folded_name = unicodedata.normalize("NFC", entry.name).casefold()
        if folded_name in seen_names:
            raise PublisherError("Published filenames must be unique ignoring case: %s" % entry.name)
        seen_names.add(folded_name)
        if extension == ".m":
            _validate_source_code(entry)
            code_files.append(entry)
        else:
            image_files.append(entry)

    if not code_files:
        raise PublisherError("Project %s needs at least one non-empty .m file." % project_directory.name)
    if not image_files:
        raise PublisherError("Project %s needs at least one PNG, JPG, or JPEG image." % project_directory.name)

    code_files.sort(key=lambda path: natural_sort_key(path.name))
    image_files.sort(key=lambda path: natural_sort_key(path.name))
    image_info = {path.name: inspect_image(path) for path in image_files}
    return SourceProject(
        project_id=project_directory.name,
        title=title,
        description=description,
        directory=project_directory,
        readme=project_directory / "README.md",
        code_files=tuple(code_files),
        image_files=tuple(image_files),
        image_info=image_info,
    )


def discover_projects(projects_root: Path) -> Sequence[SourceProject]:
    if projects_root.is_symlink() or not projects_root.is_dir():
        raise PublisherError("Source root does not exist: projects/")
    directories = [entry for entry in projects_root.iterdir() if entry.is_dir() or entry.is_symlink()]
    directories.sort(key=lambda path: natural_sort_key(path.name))
    projects: List[SourceProject] = []
    errors: List[str] = []
    for directory in directories:
        try:
            projects.append(discover_project(directory))
        except PublisherError as error:
            errors.append("%s: %s" % (directory.name, error))
    if errors:
        raise PublisherError("Source validation failed:\n- " + "\n- ".join(errors))
    return projects
