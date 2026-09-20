"""Static safety checks for the Cloud Publisher workflow."""

from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "publish-pages.yml"


class WorkflowTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = WORKFLOW.read_text(encoding="utf-8")

    def test_workflow_has_validation_build_and_pages_deployment(self) -> None:
        for required in (
            "projects/**",
            "python -m publisher.build",
            "python -m unittest discover",
            "node --check docs/js/app.js",
            "node --test tests/*.test.js",
            "python tests/http_smoke.py",
            "actions/upload-pages-artifact@",
            "actions/deploy-pages@",
        ):
            self.assertIn(required, self.source)

    def test_actions_are_pinned_and_matlab_pipeline_is_never_called(self) -> None:
        action_uses = re.findall(r"uses:\s*([^\s]+)", self.source)
        self.assertTrue(action_uses)
        self.assertTrue(all(re.search(r"@[0-9a-f]{40}$", action) for action in action_uses))
        self.assertNotIn("publish_project.m", self.source)
        self.assertNotIn("run_all.m", self.source)
        self.assertNotRegex(self.source, r"(?m)^\s*git\s+push\s+.*(?:--force|-f)(?:\s|$)")

    def test_commit_back_is_limited_and_race_checked(self) -> None:
        self.assertIn('test "$(git rev-parse origin/main)" = "${{ github.sha }}"', self.source)
        self.assertIn('git status --porcelain -- docs/content', self.source)
        self.assertIn("git add -- docs/content/catalog.json docs/content/projects", self.source)
        self.assertIn("[skip ci]", self.source)
        self.assertIn("contents: write", self.source)
        self.assertNotIn("pull_request_target", self.source)


if __name__ == "__main__":
    unittest.main()
