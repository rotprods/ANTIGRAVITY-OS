#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Restore and bootstrap an OpenClaw migration package on Mac mini.

Usage:
  setup-openclaw-mini.sh --package-dir DIR [--target-home DIR] [--install-deps]

Options:
  --package-dir DIR   Folder produced by prepare-openclaw-migration.sh (required)
  --target-home DIR   Restore destination home (default: $HOME)
  --install-deps      Run npm install in detected JS repos after restore
  -h, --help          Show this help
USAGE
}

package_dir=""
target_home="${HOME}"
install_deps=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --package-dir)
      package_dir="${2:-}"
      shift 2
      ;;
    --target-home)
      target_home="${2:-}"
      shift 2
      ;;
    --install-deps)
      install_deps=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${package_dir}" ]]; then
  echo "--package-dir is required" >&2
  usage
  exit 1
fi

archives_dir="${package_dir}/archives"
manifests_dir="${package_dir}/manifests"

if [[ ! -d "${archives_dir}" ]]; then
  echo "Missing archives dir: ${archives_dir}" >&2
  exit 1
fi

mkdir -p "${target_home}"

echo "[1/4] Rebuilding split archives (if any)..."
while IFS= read -r first_part; do
  base="${first_part%.part-00}"
  if [[ ! -f "${base}" ]]; then
    echo "  [join] $(basename "${base}")"
    cat "${base}.part-"* > "${base}"
  fi
done < <(find "${archives_dir}" -type f -name '*.part-00' | sort)

echo "[2/4] Extracting archives into ${target_home}..."
while IFS= read -r archive; do
  echo "  [extract] $(basename "${archive}")"
  tar -xzf "${archive}" -C "${target_home}"
done < <(find "${archives_dir}" -type f -name '*.tar.gz' | sort)

echo "[3/4] Git verification..."
if [[ -f "${manifests_dir}/git_repos.tsv" ]]; then
  tail -n +2 "${manifests_dir}/git_repos.tsv" | while IFS=$'\t' read -r rel_path remote branch dirty; do
    repo="${target_home}/${rel_path}"
    if [[ -d "${repo}/.git" ]]; then
      current_remote="$(git -C "${repo}" remote get-url origin 2>/dev/null || true)"
      current_branch="$(git -C "${repo}" branch --show-current 2>/dev/null || true)"
      echo "  [repo] ${rel_path} | ${current_branch:-detached} | ${current_remote:-no-origin}"
    else
      echo "  [missing-repo] ${rel_path}"
    fi
  done
else
  echo "  No git_repos.tsv found, skipping repo verification."
fi

if [[ "${install_deps}" -eq 1 ]]; then
  echo "[4/4] Installing JS dependencies where package.json exists..."
  while IFS= read -r repo; do
    if [[ -f "${repo}/package.json" ]]; then
      echo "  [npm] ${repo}"
      (cd "${repo}" && npm install --no-audit --no-fund)
    fi
  done < <(find "${target_home}/Documents" "${target_home}/.codex" -type f -name package.json -print 2>/dev/null | sed 's|/package.json$||' | sort -u)
else
  echo "[4/4] Dependency install skipped (use --install-deps)."
fi

echo
echo "Restore completed."
echo "Suggested checks:"
echo "  gh auth status"
echo "  vercel --version"
echo "  codex --version"
