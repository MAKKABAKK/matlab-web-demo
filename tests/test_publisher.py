"""Cloud Publisher unit and integration tests."""

from __future__ import annotations

import binascii
import json
import shutil
import struct
import tempfile
import unittest
import zlib
from datetime import datetime, timezone
from pathlib import Path

from publisher.build import build_repository
from publisher.validate import PublisherError, discover_project, natural_sort_key


V1_PROJECT_ID = "legacy-case"


def png_bytes(width: int = 2, height: int = 1) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        checksum = binascii.crc32(kind + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    pixels = b"\x00" + (b"\x00\x00\x00" * width)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(pixels * height))
        + chunk(b"IEND", b"")
    )


def jpeg_bytes(width: int = 3, height: int = 2) -> bytes:
    frame = bytes([8]) + struct.pack(">HH", height, width) + bytes([1, 1, 0x11, 0])
    scan = bytes([1, 1, 0, 0, 63, 0])
    return (
        b"\xff\xd8"
        + b"\xff\xc0" + struct.pack(">H", len(frame) + 2) + frame
        + b"\xff\xda" + struct.pack(">H", len(scan) + 2) + scan
        + b"\x00\xff\xd9"
    )


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def snapshot(directory: Path) -> dict:
    return {
        str(path.relative_to(directory)): path.read_bytes()
        for path in directory.rglob("*")
        if path.is_file()
    }


class PublisherTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        (self.root / "projects").mkdir()
        content = self.root / "docs" / "content"
        legacy = content / "projects" / V1_PROJECT_ID
        legacy.mkdir(parents=True)
        write_json(
            content / "catalog.json",
            {
                "schemaVersion": "2.2",
                "siteTitle": "Repository",
                "localization": {"defaultLocale": "en", "supportedLocales": ["en", "zh-Hant"]},
                "i18n": {"zh-Hant": {"siteTitle": "案例庫"}},
                "defaultProject": V1_PROJECT_ID,
                "categories": [
                    {
                        "id": "legacy-models",
                        "title": "Legacy Models",
                        "i18n": {"zh-Hant": {"title": "舊模型"}},
                        "projects": [
                            {
                                "id": V1_PROJECT_ID,
                                "title": "Legacy Case",
                                "manifest": f"projects/{V1_PROJECT_ID}/manifest.json",
                                "i18n": {"zh-Hant": {"title": "舊案例"}},
                            }
                        ],
                    }
                ],
            },
        )
        write_json(
            legacy / "manifest.json",
            {
                "schemaVersion": "2.1",
                "id": V1_PROJECT_ID,
                "title": "Legacy Case",
                "i18n": {"zh-Hant": {"title": "舊案例"}},
                "artifacts": [],
                "sections": [{"id": "overview", "title": "Overview", "blocks": []}],
            },
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def source_project(
        self,
        project_id: str = "new-project",
        readme: str = "# New Project\n\nA useful description.\n",
        code_names=("main.m",),
        image_names=("result.png",),
    ) -> Path:
        directory = self.root / "projects" / project_id
        directory.mkdir()
        (directory / "README.md").write_text(readme, encoding="utf-8")
        for name in code_names:
            (directory / name).write_text("disp('ready');\n", encoding="utf-8")
        for name in image_names:
            payload = png_bytes() if Path(name).suffix.lower() == ".png" else jpeg_bytes()
            (directory / name).write_bytes(payload)
        return directory

    def catalog(self) -> dict:
        return json.loads((self.root / "docs" / "content" / "catalog.json").read_text(encoding="utf-8"))

    def manifest(self, project_id: str = "new-project") -> dict:
        path = self.root / "docs" / "content" / "projects" / project_id / "manifest.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def test_builds_valid_project_and_preserves_v1_contract(self) -> None:
        self.source_project()
        legacy_before = snapshot(self.root / "docs" / "content" / "projects" / V1_PROJECT_ID)
        report = build_repository(self.root, datetime(2026, 9, 20, 2, 3, 4, tzinfo=timezone.utc))

        self.assertTrue(report.changed)
        self.assertEqual(report.project_ids, ("new-project",))
        catalog = self.catalog()
        self.assertEqual(catalog["defaultProject"], V1_PROJECT_ID)
        self.assertEqual(catalog["categories"][0]["id"], "legacy-models")
        self.assertEqual(catalog["categories"][0]["i18n"]["zh-Hant"]["title"], "舊模型")
        self.assertEqual(catalog["categories"][1]["id"], "published-projects")
        self.assertEqual(snapshot(self.root / "docs" / "content" / "projects" / V1_PROJECT_ID), legacy_before)

        manifest = self.manifest()
        self.assertEqual(manifest["schemaVersion"], "2.1")
        self.assertEqual(manifest["title"], "New Project")
        self.assertEqual(manifest["description"], "A useful description.")
        self.assertNotIn("i18n", manifest)
        self.assertEqual([section["id"] for section in manifest["sections"]], ["overview", "source-code"])
        self.assertTrue((self.root / "docs" / "content" / "projects" / "new-project" / "code" / "main.m").is_file())

    def test_repository_without_v2_sources_is_a_byte_for_byte_noop(self) -> None:
        baseline = snapshot(self.root / "docs" / "content")
        report = build_repository(self.root)
        self.assertFalse(report.changed)
        self.assertEqual(snapshot(self.root / "docs" / "content"), baseline)

    def test_accepts_png_jpg_jpeg_and_naturally_sorts_all_files(self) -> None:
        directory = self.source_project(
            code_names=("step10.m", "step2.m", "step1.m"),
            image_names=("plot10.jpg", "plot2.jpeg", "plot1.png"),
        )
        project = discover_project(directory)
        self.assertEqual([path.name for path in project.code_files], ["step1.m", "step2.m", "step10.m"])
        self.assertEqual([path.name for path in project.image_files], ["plot1.png", "plot2.jpeg", "plot10.jpg"])

        build_repository(self.root)
        manifest = self.manifest()
        self.assertEqual(
            [artifact["file"] for artifact in manifest["artifacts"]],
            [
                "plots/plot1.png", "plots/plot2.jpeg", "plots/plot10.jpg",
                "code/step1.m", "code/step2.m", "code/step10.m",
            ],
        )
        plot = manifest["artifacts"][0]
        self.assertEqual((plot["label"], plot["alt"], plot["caption"]), ("Plot1", "Plot1", "Plot1"))

    def test_optional_description_can_be_empty(self) -> None:
        self.source_project(readme="# Name Only\n")
        build_repository(self.root)
        self.assertEqual(self.manifest()["description"], "")

    def test_reuses_an_existing_empty_published_category(self) -> None:
        catalog = self.catalog()
        catalog["categories"].append({
            "id": "published-projects",
            "title": "Custom Published Title",
            "description": "Keep this category metadata.",
            "projects": [],
        })
        write_json(self.root / "docs" / "content" / "catalog.json", catalog)
        self.source_project()
        build_repository(self.root)
        published = self.catalog()["categories"][-1]
        self.assertEqual(published["title"], "Custom Published Title")
        self.assertEqual([project["id"] for project in published["projects"]], ["new-project"])

    def test_ignores_unsupported_regular_files(self) -> None:
        directory = self.source_project()
        (directory / "notes.txt").write_text("ignored", encoding="utf-8")
        build_repository(self.root)
        self.assertFalse((self.root / "docs" / "content" / "projects" / "new-project" / "notes.txt").exists())

    def test_rejects_missing_readme_or_h1(self) -> None:
        directory = self.source_project()
        (directory / "README.md").unlink()
        with self.assertRaisesRegex(PublisherError, "README.md is required"):
            build_repository(self.root)
        (directory / "README.md").write_text("No heading", encoding="utf-8")
        with self.assertRaisesRegex(PublisherError, "must contain"):
            build_repository(self.root)

    def test_rejects_missing_code_or_image(self) -> None:
        directory = self.source_project()
        (directory / "main.m").unlink()
        with self.assertRaisesRegex(PublisherError, "at least one non-empty .m"):
            build_repository(self.root)
        (directory / "main.m").write_text("x = 1;", encoding="utf-8")
        (directory / "result.png").unlink()
        with self.assertRaisesRegex(PublisherError, "at least one PNG"):
            build_repository(self.root)

    def test_rejects_empty_or_non_utf8_matlab_source(self) -> None:
        directory = self.source_project()
        (directory / "main.m").write_text(" \n", encoding="utf-8")
        with self.assertRaisesRegex(PublisherError, "source is empty"):
            build_repository(self.root)
        (directory / "main.m").write_bytes(b"\xff\xfe")
        with self.assertRaisesRegex(PublisherError, "valid UTF-8"):
            build_repository(self.root)

    def test_rejects_invalid_images_and_extension_mismatch(self) -> None:
        directory = self.source_project()
        (directory / "result.png").write_bytes(b"not an image")
        with self.assertRaisesRegex(PublisherError, "Invalid image"):
            build_repository(self.root)
        (directory / "result.png").write_bytes(jpeg_bytes())
        with self.assertRaisesRegex(PublisherError, "PNG signature"):
            build_repository(self.root)

    def test_rejects_invalid_folder_nested_directory_and_symlink(self) -> None:
        self.source_project("Not-Kebab")
        with self.assertRaisesRegex(PublisherError, "lowercase ASCII kebab-case"):
            build_repository(self.root)
        shutil.rmtree(self.root / "projects" / "Not-Kebab")
        directory = self.source_project()
        (directory / "nested").mkdir()
        with self.assertRaisesRegex(PublisherError, "Nested directories"):
            build_repository(self.root)
        (directory / "nested").rmdir()
        (directory / "linked.m").symlink_to(directory / "main.m")
        with self.assertRaisesRegex(PublisherError, "Symlinks are not allowed"):
            build_repository(self.root)

    def test_rejects_case_insensitive_duplicate_published_filenames(self) -> None:
        directory = self.source_project(image_names=("plot.png", "PLOT.PNG"))
        if len([path for path in directory.iterdir() if path.suffix.lower() == ".png"]) < 2:
            self.skipTest("The local filesystem is case-insensitive; Linux CI exercises this case.")
        with self.assertRaisesRegex(PublisherError, "unique ignoring case"):
            discover_project(directory)

    def test_rejects_v1_id_and_unregistered_output_conflicts(self) -> None:
        self.source_project(V1_PROJECT_ID)
        with self.assertRaisesRegex(PublisherError, "conflicts with an existing V1 project"):
            build_repository(self.root)
        shutil.rmtree(self.root / "projects" / V1_PROJECT_ID)
        self.source_project("orphan")
        (self.root / "docs" / "content" / "projects" / "orphan").mkdir()
        with self.assertRaisesRegex(PublisherError, "unregistered content directory"):
            build_repository(self.root)

    def test_rejects_duplicate_project_id_already_present_in_catalog(self) -> None:
        catalog = self.catalog()
        duplicate_category = {
            "id": "duplicate-models",
            "title": "Duplicate Models",
            "projects": [
                {
                    "id": V1_PROJECT_ID,
                    "title": "Duplicate",
                    "manifest": f"projects/{V1_PROJECT_ID}/manifest.json",
                }
            ],
        }
        catalog["categories"].append(duplicate_category)
        write_json(self.root / "docs" / "content" / "catalog.json", catalog)
        with self.assertRaisesRegex(PublisherError, "Duplicate project ID in catalog"):
            build_repository(self.root)

    def test_failed_build_never_changes_published_content(self) -> None:
        baseline = snapshot(self.root / "docs" / "content")
        directory = self.source_project()
        (directory / "result.png").write_bytes(b"broken")
        with self.assertRaises(PublisherError):
            build_repository(self.root)
        self.assertEqual(snapshot(self.root / "docs" / "content"), baseline)

    def test_removing_source_never_auto_deletes_published_project(self) -> None:
        directory = self.source_project()
        build_repository(self.root)
        baseline = snapshot(self.root / "docs" / "content")
        shutil.rmtree(directory)
        with self.assertRaisesRegex(PublisherError, "automatic deletion is disabled"):
            build_repository(self.root)
        self.assertEqual(snapshot(self.root / "docs" / "content"), baseline)

    def test_unchanged_build_is_deterministic_and_preserves_timestamp(self) -> None:
        self.source_project()
        first_time = datetime(2026, 9, 20, 1, 0, 0, tzinfo=timezone.utc)
        second_time = datetime(2026, 9, 21, 1, 0, 0, tzinfo=timezone.utc)
        first = build_repository(self.root, first_time)
        baseline = snapshot(self.root / "docs" / "content")
        second = build_repository(self.root, second_time)

        self.assertTrue(first.changed)
        self.assertFalse(second.changed)
        self.assertEqual(snapshot(self.root / "docs" / "content"), baseline)
        self.assertEqual(self.manifest()["lastUpdated"], "2026-09-20 01:00:00")

    def test_update_changes_version_timestamp_and_keeps_catalog_position(self) -> None:
        first = self.source_project("z-project")
        self.source_project("a-project")
        build_repository(self.root, datetime(2026, 9, 20, tzinfo=timezone.utc))
        category = self.catalog()["categories"][-1]
        self.assertEqual([item["id"] for item in category["projects"]], ["a-project", "z-project"])
        previous_version = self.manifest("z-project")["version"]

        (first / "main.m").write_text("disp('changed');\n", encoding="utf-8")
        build_repository(self.root, datetime(2026, 9, 22, tzinfo=timezone.utc))
        category = self.catalog()["categories"][-1]
        self.assertEqual([item["id"] for item in category["projects"]], ["a-project", "z-project"])
        updated = self.manifest("z-project")
        self.assertNotEqual(updated["version"], previous_version)
        self.assertEqual(updated["lastUpdated"], "2026-09-22 00:00:00")

    def test_natural_sort_key_is_numeric_and_case_insensitive(self) -> None:
        values = ["File10.m", "file2.m", "file1.m"]
        self.assertEqual(sorted(values, key=natural_sort_key), ["file1.m", "file2.m", "File10.m"])


if __name__ == "__main__":
    unittest.main()
