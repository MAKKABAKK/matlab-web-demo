"""Build current Catalog 2.2 / Manifest 2.1 content from ``projects/``."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from .validate import (
    PublisherError,
    SourceProject,
    artifact_id,
    discover_projects,
    inspect_image,
    label_from_filename,
    natural_sort_key,
    validate_project_id,
)


PUBLISHED_CATEGORY_ID = "published-projects"
PUBLISHED_CATEGORY_TITLE = "Published Projects"
PUBLISHED_CATEGORY_DESCRIPTION = "Projects published from repository source folders."
BLOCK_ARTIFACT_KINDS = {"plot": "plot", "code": "matlab-code", "markdown": "markdown"}
SUPPORTED_BLOCK_TYPES = {
    "text", "plot", "code", "markdown", "metrics", "table", "callout", "steps", "split"
}


@dataclass(frozen=True)
class BuildReport:
    project_ids: Tuple[str, ...]
    changed: bool


def _read_json(path: Path) -> Dict[str, object]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PublisherError("Could not read valid JSON: %s" % path) from error


def _json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_json_text(value), encoding="utf-8")


def _project_fingerprint(project: SourceProject) -> str:
    digest = hashlib.sha256()
    files = [project.readme, *project.code_files, *project.image_files]
    for path in sorted(files, key=lambda item: natural_sort_key(item.name)):
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()[:16]


def _timestamp(now: Optional[datetime]) -> str:
    value = now or datetime.now(timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _catalog_index(catalog: Dict[str, object]) -> Tuple[Dict[str, Dict[str, object]], Dict[str, str]]:
    if catalog.get("schemaVersion") != "2.2" or not isinstance(catalog.get("categories"), list):
        raise PublisherError("catalog.json must use Catalog schemaVersion 2.2 with categories[].")
    categories: Dict[str, Dict[str, object]] = {}
    projects: Dict[str, str] = {}
    for category in catalog["categories"]:
        if not isinstance(category, dict):
            raise PublisherError("Every catalog category must be an object.")
        category_id = category.get("id")
        if not isinstance(category_id, str):
            raise PublisherError("Every catalog category needs an ID.")
        validate_project_id(category_id)
        if category_id in categories:
            raise PublisherError("Duplicate catalog category ID: %s" % category_id)
        if not isinstance(category.get("title"), str) or not isinstance(category.get("projects"), list):
            raise PublisherError("Catalog category %s needs a title and projects array." % category_id)
        if not category["projects"] and category_id != PUBLISHED_CATEGORY_ID:
            raise PublisherError("Catalog category %s must contain at least one project." % category_id)
        categories[category_id] = category
        for project in category["projects"]:
            if not isinstance(project, dict) or not isinstance(project.get("id"), str):
                raise PublisherError("Every catalog project needs an ID.")
            project_id = project["id"]
            validate_project_id(project_id)
            if project_id in projects:
                raise PublisherError("Duplicate project ID in catalog: %s" % project_id)
            projects[project_id] = category_id
    if catalog.get("defaultProject") not in projects:
        raise PublisherError("catalog.defaultProject must continue to reference an existing project.")
    return categories, projects


def _previous_manifest(content_root: Path, project_id: str) -> Optional[Dict[str, object]]:
    path = content_root / "projects" / project_id / "manifest.json"
    return _read_json(path) if path.is_file() else None


def _build_manifest(
    project: SourceProject,
    version: str,
    last_updated: str,
) -> Dict[str, object]:
    artifacts: List[Dict[str, object]] = []
    plot_blocks: List[Dict[str, object]] = []
    code_blocks: List[Dict[str, object]] = []
    used_ids = set()

    for image in project.image_files:
        artifact_identifier = artifact_id("plot", image.name, used_ids)
        used_ids.add(artifact_identifier)
        label = label_from_filename(image.name)
        artifacts.append({
            "id": artifact_identifier,
            "kind": "plot",
            "file": "plots/%s" % image.name,
            "label": label,
            "alt": label,
            "caption": label,
        })
        plot_blocks.append({"type": "plot", "artifact": artifact_identifier})

    for source in project.code_files:
        artifact_identifier = artifact_id("code", source.name, used_ids)
        used_ids.add(artifact_identifier)
        label = source.name
        artifacts.append({
            "id": artifact_identifier,
            "kind": "matlab-code",
            "file": "code/%s" % source.name,
            "label": label,
        })
        code_blocks.append({
            "type": "code",
            "artifact": artifact_identifier,
            "title": label,
        })

    return {
        "schemaVersion": "2.1",
        "id": project.project_id,
        "title": project.title,
        "eyebrow": "PUBLISHED MATLAB PROJECT",
        "description": project.description,
        "version": version,
        "lastUpdated": last_updated,
        "artifacts": artifacts,
        "sections": [
            {
                "id": "overview",
                "title": "Overview",
                "shortTitle": "Overview",
                "summary": "Project images.",
                "blocks": plot_blocks,
            },
            {
                "id": "source-code",
                "title": "Source Code",
                "shortTitle": "Source Code",
                "summary": "MATLAB source files.",
                "blocks": code_blocks,
            },
        ],
    }


def _copy_project(project: SourceProject, content_root: Path, manifest: Dict[str, object]) -> None:
    target = content_root / "projects" / project.project_id
    if target.exists():
        shutil.rmtree(target)
    (target / "code").mkdir(parents=True)
    (target / "plots").mkdir(parents=True)
    for source in project.code_files:
        shutil.copy2(str(source), str(target / "code" / source.name))
    for image in project.image_files:
        shutil.copy2(str(image), str(target / "plots" / image.name))
    _write_json(target / "manifest.json", manifest)


def _safe_artifact_path(project_directory: Path, relative_path: str) -> Path:
    if not relative_path or "\\" in relative_path:
        raise PublisherError("Artifact path must be a non-empty forward-slash path.")
    relative = Path(relative_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise PublisherError("Artifact path leaves its project directory: %s" % relative_path)
    resolved = (project_directory / relative).resolve()
    if project_directory.resolve() not in resolved.parents:
        raise PublisherError("Artifact path leaves its project directory: %s" % relative_path)
    return resolved


def _validate_blocks(
    blocks: object,
    artifacts: Dict[str, Dict[str, object]],
    project_id: str,
    location: str,
) -> None:
    if not isinstance(blocks, list):
        raise PublisherError("%s must be a blocks array in %s." % (location, project_id))
    for index, block in enumerate(blocks):
        block_location = "%s[%d]" % (location, index)
        if not isinstance(block, dict) or block.get("type") not in SUPPORTED_BLOCK_TYPES:
            raise PublisherError("Unsupported content block at %s in %s." % (block_location, project_id))
        block_type = str(block["type"])
        expected_kind = BLOCK_ARTIFACT_KINDS.get(block_type)
        if expected_kind:
            artifact_id_value = block.get("artifact")
            artifact = artifacts.get(str(artifact_id_value))
            if artifact is None or artifact.get("kind") != expected_kind:
                raise PublisherError("Invalid artifact reference at %s in %s." % (block_location, project_id))
        if block_type in {"metrics", "table"}:
            source = artifacts.get(str(block.get("source")))
            if source is None or source.get("kind") != "json":
                raise PublisherError("Invalid JSON source at %s in %s." % (block_location, project_id))
        if block_type == "split":
            children = block.get("blocks")
            if not isinstance(children, list) or len(children) != 2:
                raise PublisherError("Split block must have two children at %s in %s." % (block_location, project_id))
            if any(isinstance(child, dict) and child.get("type") == "split" for child in children):
                raise PublisherError("Nested split block at %s in %s." % (block_location, project_id))
            _validate_blocks(children, artifacts, project_id, "%s.blocks" % block_location)


def validate_generated_content(content_root: Path) -> None:
    catalog = _read_json(content_root / "catalog.json")
    _, project_categories = _catalog_index(catalog)
    for category in catalog["categories"]:
        if not category["projects"]:
            raise PublisherError("Generated catalog category %s is empty." % category["id"])
    seen_manifests = set()
    for category in catalog["categories"]:
        for project in category["projects"]:
            manifest_relative = project.get("manifest")
            if not isinstance(manifest_relative, str):
                raise PublisherError("Catalog project %s has no manifest path." % project.get("id"))
            manifest_path = _safe_artifact_path(content_root, manifest_relative)
            if not manifest_path.is_file():
                raise PublisherError("Missing project manifest: %s" % manifest_relative)
            manifest = _read_json(manifest_path)
            project_id = project["id"]
            if manifest.get("schemaVersion") != "2.1" or manifest.get("id") != project_id:
                raise PublisherError("Manifest does not match catalog project: %s" % project_id)
            if (
                not isinstance(manifest.get("artifacts"), list)
                or not isinstance(manifest.get("sections"), list)
                or not manifest["sections"]
            ):
                raise PublisherError("Manifest needs artifacts and non-empty sections arrays: %s" % project_id)
            artifacts_by_id: Dict[str, Dict[str, object]] = {}
            project_directory = manifest_path.parent
            for artifact in manifest["artifacts"]:
                if not isinstance(artifact, dict) or not isinstance(artifact.get("id"), str):
                    raise PublisherError("Manifest artifact is invalid: %s" % project_id)
                validate_project_id(artifact["id"])
                if artifact["id"] in artifacts_by_id:
                    raise PublisherError("Duplicate artifact ID in %s: %s" % (project_id, artifact["id"]))
                if not isinstance(artifact.get("kind"), str):
                    raise PublisherError("Manifest artifact kind is invalid: %s" % project_id)
                artifacts_by_id[artifact["id"]] = artifact
                artifact_path = _safe_artifact_path(project_directory, artifact.get("file", ""))
                if not artifact_path.is_file() or artifact_path.stat().st_size == 0:
                    raise PublisherError("Missing or empty artifact: %s" % artifact.get("file"))
                if artifact.get("kind") == "plot":
                    inspect_image(artifact_path)
            for artifact in manifest["artifacts"]:
                generated_by = artifact.get("generatedBy")
                if generated_by is not None and generated_by not in artifacts_by_id:
                    raise PublisherError("Invalid generatedBy reference in %s: %s" % (project_id, generated_by))
            section_ids = set()
            for section_index, section in enumerate(manifest["sections"]):
                if not isinstance(section, dict) or not isinstance(section.get("id"), str):
                    raise PublisherError("Manifest section is invalid: %s" % project_id)
                validate_project_id(section["id"])
                if section["id"] in section_ids:
                    raise PublisherError("Duplicate section ID in %s: %s" % (project_id, section["id"]))
                section_ids.add(section["id"])
                _validate_blocks(
                    section.get("blocks"),
                    artifacts_by_id,
                    project_id,
                    "sections[%d].blocks" % section_index,
                )
            seen_manifests.add(project_id)
    if seen_manifests != set(project_categories):
        raise PublisherError("Catalog and manifest project IDs do not match.")


def _directories_equal(left: Path, right: Path) -> bool:
    left_files = sorted(path.relative_to(left) for path in left.rglob("*") if path.is_file())
    right_files = sorted(path.relative_to(right) for path in right.rglob("*") if path.is_file())
    if left_files != right_files:
        return False
    return all((left / relative).read_bytes() == (right / relative).read_bytes() for relative in left_files)


def _replace_content_safely(current: Path, staged: Path) -> None:
    backup = current.parent / (".content-backup-%s" % uuid.uuid4().hex)
    os.replace(str(current), str(backup))
    try:
        os.replace(str(staged), str(current))
    except Exception:
        os.replace(str(backup), str(current))
        raise
    shutil.rmtree(backup, ignore_errors=True)


def build_repository(repository_root: Path, now: Optional[datetime] = None) -> BuildReport:
    root = repository_root.resolve()
    source_root = root / "projects"
    docs_root = root / "docs"
    content_root = docs_root / "content"
    if not content_root.is_dir():
        raise PublisherError("Repository must contain docs/content.")

    source_projects = list(discover_projects(source_root))
    source_by_id = {project.project_id: project for project in source_projects}
    if len(source_by_id) != len(source_projects):
        raise PublisherError("Duplicate project IDs were discovered below projects/.")

    with tempfile.TemporaryDirectory(prefix=".publisher-stage-", dir=str(docs_root)) as temporary:
        staged_content = Path(temporary) / "content"
        shutil.copytree(str(content_root), str(staged_content))
        catalog = _read_json(staged_content / "catalog.json")
        categories, catalog_projects = _catalog_index(catalog)
        published_category = categories.get(PUBLISHED_CATEGORY_ID)
        managed_entries = list(published_category["projects"]) if published_category else []
        managed_ids = [entry.get("id") for entry in managed_entries]
        if len(set(managed_ids)) != len(managed_ids):
            raise PublisherError("published-projects contains duplicate project IDs.")

        missing_sources = sorted(set(managed_ids) - set(source_by_id), key=natural_sort_key)
        if missing_sources:
            raise PublisherError(
                "Source project missing; automatic deletion is disabled: %s"
                % ", ".join(missing_sources)
            )

        for project_id in source_by_id:
            category_id = catalog_projects.get(project_id)
            if category_id and category_id != PUBLISHED_CATEGORY_ID:
                raise PublisherError(
                    "Source project ID conflicts with an existing V1 project: %s" % project_id
                )
            existing_directory = staged_content / "projects" / project_id
            if not category_id and existing_directory.exists():
                raise PublisherError(
                    "Source project would overwrite an unregistered content directory: %s" % project_id
                )

        if source_projects and published_category is None:
            published_category = {
                "id": PUBLISHED_CATEGORY_ID,
                "title": PUBLISHED_CATEGORY_TITLE,
                "description": PUBLISHED_CATEGORY_DESCRIPTION,
                "projects": [],
            }
            catalog["categories"].append(published_category)
            managed_entries = published_category["projects"]

        build_time = _timestamp(now)
        entries_by_id = {entry["id"]: entry for entry in managed_entries}
        ordered_ids = list(managed_ids)
        new_ids = sorted(set(source_by_id) - set(ordered_ids), key=natural_sort_key)
        ordered_ids.extend(new_ids)

        generated_entries: Dict[str, Dict[str, object]] = {}
        for project_id in ordered_ids:
            project = source_by_id[project_id]
            version = _project_fingerprint(project)
            previous = _previous_manifest(staged_content, project_id)
            last_updated = (
                str(previous.get("lastUpdated"))
                if previous and previous.get("version") == version and previous.get("lastUpdated")
                else build_time
            )
            manifest = _build_manifest(project, version, last_updated)
            _copy_project(project, staged_content, manifest)
            generated_entries[project_id] = {
                "id": project_id,
                "title": project.title,
                "description": project.description,
                "manifest": "projects/%s/manifest.json" % project_id,
                "lastUpdated": last_updated,
            }

        if published_category is not None:
            published_category["projects"] = [generated_entries[project_id] for project_id in ordered_ids]

        if source_projects or published_category is not None:
            _write_json(staged_content / "catalog.json", catalog)
        validate_generated_content(staged_content)
        changed = not _directories_equal(content_root, staged_content)
        if changed:
            _replace_content_safely(content_root, staged_content)

    return BuildReport(tuple(project.project_id for project in source_projects), changed)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build static website content from projects/ source folders.")
    parser.add_argument("--repository-root", default=".", help="Repository root; defaults to the current directory.")
    arguments = parser.parse_args(argv)
    try:
        report = build_repository(Path(arguments.repository_root))
    except PublisherError as error:
        parser.exit(1, "Cloud Publisher failed: %s\n" % error)
    status = "updated" if report.changed else "already current"
    print("Cloud Publisher passed: %d project(s), docs/content %s." % (len(report.project_ids), status))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
