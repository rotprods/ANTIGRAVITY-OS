#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Prepare migration package for OpenClaw Mac mini.

Usage:
  prepare-openclaw-migration.sh [--out DIR] [--split-airdrop] [--part-size-mb N] [--include ABS_PATH ...]

Options:
  --out DIR            Output directory (default: ~/Desktop/openclaw-migration-<timestamp>)
  --split-airdrop      Split each .tar.gz into AirDrop-friendly parts
  --part-size-mb N     Split size in MB when --split-airdrop is used (default: 3800)
  --include ABS_PATH   Extra absolute path to include (can be repeated)
  -h, --help           Show this help
USAGE
}

timestamp="$(date +%Y%m%d-%H%M%S)"
out_dir="${HOME}/Desktop/openclaw-migration-${timestamp}"
split_airdrop=0
part_size_mb=3800

extra_includes=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      out_dir="${2:-}"
      shift 2
      ;;
    --split-airdrop)
      split_airdrop=1
      shift
      ;;
    --part-size-mb)
      part_size_mb="${2:-}"
      shift 2
      ;;
    --include)
      extra_includes+=("${2:-}")
      shift 2
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

mkdir -p "${out_dir}/archives" "${out_dir}/manifests"
script_dir="$(cd "$(dirname "$0")" && pwd)"

sources=(
  "${HOME}/AGENTS.md"
  "${HOME}/.codex"
  "${HOME}/.claude"
  "${HOME}/.gemini/antigravity"
  "${HOME}/Documents/AI OPS/ANTIGRAVITY-OS"
  "${HOME}/Documents/AI OPS/github-repos"
  "${HOME}/Documents/AI OPS/pixel-agents"
  "${HOME}/Documents/AI OPS/visual agents/poke-agentss"
  "${HOME}/Documents/agenda urbana/agenda-urbana-2040"
  "${HOME}/Documents/yamaneko-fight-club"
  "${HOME}/Documents/codigo-bushido-landing"
)

if [[ ${#extra_includes[@]} -gt 0 ]]; then
  for p in "${extra_includes[@]}"; do
    sources+=("$p")
  done
fi

exclude_args=(
  "--exclude=.DS_Store"
  "--exclude=*/node_modules/*"
  "--exclude=*/.next/*"
  "--exclude=*/dist/*"
  "--exclude=*/build/*"
  "--exclude=*/coverage/*"
  "--exclude=*/playwright-report/*"
  "--exclude=*/test-results/*"
  "--exclude=*/.cache/*"
  "--exclude=*/Library/Caches/*"
  "--exclude=*/.gemini/antigravity/browser_recordings/*"
)

package_manifest="${out_dir}/manifests/package_manifest.tsv"
git_manifest="${out_dir}/manifests/git_repos.tsv"
md_manifest="${out_dir}/manifests/md_context_hits.tsv"

{
  echo -e "source_path\tarchive_name\tarchive_size_bytes"
} > "${package_manifest}"

echo -e "repo_path\tremote_url\tbranch\tdirty" > "${git_manifest}"
echo -e "file\tline\tmatch" > "${md_manifest}"

sanitize_name() {
  local rel="$1"
  echo "${rel}" | tr '/ ' '__' | tr -cd '[:alnum:]_.-'
}

collect_git_repo() {
  local repo="$1"
  local rel="${repo#${HOME}/}"
  local remote branch dirty
  remote="$(git -C "${repo}" remote get-url origin 2>/dev/null || true)"
  branch="$(git -C "${repo}" branch --show-current 2>/dev/null || true)"
  if [[ -n "$(git -C "${repo}" status --porcelain 2>/dev/null || true)" ]]; then
    dirty="yes"
  else
    dirty="no"
  fi
  echo -e "${rel}\t${remote}\t${branch}\t${dirty}" >> "${git_manifest}"
}

tmp_repos_file="$(mktemp)"
trap 'rm -f "${tmp_repos_file}"' EXIT

for src in "${sources[@]}"; do
  [[ -n "${src}" ]] || continue
  if [[ ! -e "${src}" ]]; then
    echo "[skip] Missing: ${src}"
    continue
  fi

  rel="${src#${HOME}/}"
  if [[ "${rel}" == "${src}" ]]; then
    echo "[skip] Path must be under HOME for portable restore: ${src}"
    continue
  fi

  slug="$(sanitize_name "${rel}")"
  archive="${out_dir}/archives/${slug}.tar.gz"

  echo "[pack] ${rel}"
  tar -czf "${archive}" "${exclude_args[@]}" -C "${HOME}" "${rel}"

  size_bytes="$(stat -f '%z' "${archive}")"
  echo -e "${rel}\t$(basename "${archive}")\t${size_bytes}" >> "${package_manifest}"

  if [[ "${split_airdrop}" -eq 1 ]]; then
    split -d -a 2 -b "${part_size_mb}m" "${archive}" "${archive}.part-"
    rm -f "${archive}"
  fi

  if [[ -d "${src}" ]]; then
    while IFS= read -r gitdir; do
      repo="${gitdir%/.git}"
      echo "${repo}" >> "${tmp_repos_file}"
    done < <(find "${src}" -type d -name .git -prune -print 2>/dev/null)
  fi
done

if [[ -s "${tmp_repos_file}" ]]; then
  sort -u "${tmp_repos_file}" | while IFS= read -r repo; do
    [[ -n "${repo}" ]] || continue
    collect_git_repo "${repo}"
  done
fi

for src in "${sources[@]}"; do
  [[ -d "${src}" ]] || continue
  rg -n --glob '*.md' --glob '!**/node_modules/**' --glob '!**/.git/**' \
    -i "oculops|oculos|antigravity|openclaw|skills|github|repo" \
    "${src}" 2>/dev/null | head -n 500 >> "${md_manifest}" || true
done

cat > "${out_dir}/README-RESTORE.txt" <<'README'
1) Move this folder to the Mac mini (AirDrop or external disk).
2) On the Mac mini, run:
   bash setup-openclaw-mini.sh --package-dir "<THIS_FOLDER>"
3) Optional dependency install:
   bash setup-openclaw-mini.sh --package-dir "<THIS_FOLDER>" --install-deps
README

cp "${script_dir}/setup-openclaw-mini.sh" "${out_dir}/setup-openclaw-mini.sh"
chmod +x "${out_dir}/setup-openclaw-mini.sh"

echo
echo "Migration package ready:"
echo "  ${out_dir}"
echo "Manifests:"
echo "  ${package_manifest}"
echo "  ${git_manifest}"
