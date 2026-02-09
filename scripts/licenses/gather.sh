#!/usr/bin/env bash
# ETL License Gather Script
# Purpose: Collect licenses from source repositories for compliance
# Usage: ./scripts/licenses/gather.sh [source_dir]

set -e

# Configuration
LICENSE_DIR="licenses"
SOURCE_DIR="${1:-.}"

# License file names to search for
LICENSE_FILES=(
    "LICENSE"
    "LICENSE.txt"
    "LICENSE.md"
    "COPYING"
    "COPYING.txt"
    "UNLICENSE"
    "LICENSE-MIT"
    "LICENSE-BSD"
)

# Source repositories and their license types (for reference)
declare -A SOURCE_LICENSES=(
    ["binlist/data"]="MIT"
    ["venelinkochev/bin-list-data"]="MIT"
    ["aderyabin/bin_list"]="MIT"
    ["braintree/credit-card-type"]="MIT"
    ["paylike/binlookup"]="MIT"
    ["drmonkeyninja/test-payment-cards"]="MIT"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create license directory
mkdir -p "$LICENSE_DIR"

# Function to find and copy license file
copy_license() {
    local source_path="$1"
    local repo_name="$2"
    local license_content=""
    local license_file_found=""

    # Search for license file
    for license_file in "${LICENSE_FILES[@]}"; do
        if [ -f "$source_path/$license_file" ]; then
            license_content=$(cat "$source_path/$license_file")
            license_file_found="$license_file"
            break
        fi
    done

    # If no license file found, try to find in common directories
    if [ -z "$license_content" ]; then
        local search_paths=("$source_path" "$source_path/docs" "$source_path")
        for search_path in "${search_paths[@]}"; do
            for license_file in "${LICENSE_FILES[@]}"; do
                if [ -f "$search_path/$license_file" ]; then
                    license_content=$(cat "$search_path/$license_file")
                    license_file_found="$license_file"
                    break 2
                fi
            done
        done
    fi

    # Check if known license type exists
    if [ -z "$license_content" ] && [ -n "${SOURCE_LICENSES[$repo_name]}" ]; then
        log_warn "No license file found for $repo_name, using known license: ${SOURCE_LICENSES[$repo_name]}"
        license_content="# License: ${SOURCE_LICENSES[$repo_name]}\n# Note: License file not found in repository, using known license type.\n"
        license_file_found="LICENSE (inferred)"
    fi

    # Write license file
    if [ -n "$license_content" ]; then
        echo -e "$license_content" > "$LICENSE_DIR/${repo_name}.LICENSE"
        log_info "Copied license for $repo_name -> ${repo_name}.LICENSE"
        return 0
    else
        log_error "No license found for $repo_name"
        echo "# License: UNKNOWN" > "$LICENSE_DIR/${repo_name}.LICENSE"
        return 1
    fi
}

# Function to check repository for git info
get_git_info() {
    local source_path="$1"
    local commit_sha=""
    local remote_url=""

    if [ -d "$source_path/.git" ]; then
        commit_sha=$(cd "$source_path" && git rev-parse HEAD 2>/dev/null || echo "unknown")
        remote_url=$(cd "$source_path" && git remote get-url origin 2>/dev/null || echo "unknown")
    fi

    echo "$commit_sha|$remote_url"
}

# Main function
main() {
    log_info "Gathering licenses from source repositories..."
    log_info "Source directory: $SOURCE_DIR"
    log_info "License directory: $LICENSE_DIR"
    echo ""

    # Find all subdirectories that might be source repos
    local repos=()

    # Look for specific known repos
    for repo_name in "${!SOURCE_LICENSES[@]}"; do
        if [ -d "$SOURCE_DIR/$repo_name" ] || [ -d "$SOURCE_DIR/${repo_name//\//-}" ]; then
            repos+=("$repo_name")
        fi
    done

    # Also look for any directory that might be a repo
    for dir in "$SOURCE_DIR"/*/; do
        local dirname=$(basename "$dir")
        # Skip non-repo directories
        if [[ ! "$dirname" =~ ^(node_modules|dist|build|coverage|licenses|scripts|src|tests) ]]; then
            repos+=("$dirname")
        fi
    done

    # Process each repository
    local success_count=0
    local fail_count=0

    echo "----------------------------------------"
    for repo in "${repos[@]}"; do
        local repo_path="$SOURCE_DIR/$repo"
        # Handle repo names with slashes
        repo_path="${repo_path//\//-}"

        if [ -d "$repo_path" ]; then
            log_info "Processing: $repo"

            # Get git info
            git_info=$(get_git_info "$repo_path")
            commit_sha=$(echo "$git_info" | cut -d'|' -f1)
            remote_url=$(echo "$git_info" | cut -d'|' -f2)

            # Copy license
            if copy_license "$repo_path" "$repo"; then
                # Append git info to license file
                if [ "$commit_sha" != "unknown" ]; then
                    echo "" >> "$LICENSE_DIR/${repo}.LICENSE"
                    echo "----------------------------------------" >> "$LICENSE_DIR/${repo}.LICENSE"
                    echo "Source Repository: $remote_url" >> "$LICENSE_DIR/${repo}.LICENSE"
                    echo "Commit: $commit_sha" >> "$LICENSE_DIR/${repo}.LICENSE"
                    echo "Gathered: $(date -Iseconds)" >> "$LICENSE_DIR/${repo}.LICENSE"
                fi
                ((success_count++))
            else
                ((fail_count++))
            fi
        else
            log_warn "Directory not found: $repo_path"
        fi
        echo ""
    done

    echo "----------------------------------------"
    log_info "License gathering complete!"
    log_info "Success: $success_count"
    log_info "Failed: $fail_count"
    log_info "Licenses saved to: $LICENSE_DIR/"

    # Generate attribution summary
    echo ""
    log_info "Generating attribution summary..."

    cat > "$LICENSE_DIR/ATTRIBUTION.md" << EOF
# Attribution and License Summary

Generated: $(date -Iseconds)

## Source Repositories

| Repository | License | Source |
|------------|---------|--------|
EOF

    for repo in "${repos[@]}"; do
        local license_file="$LICENSE_DIR/${repo}.LICENSE"
        if [ -f "$license_file" ]; then
            local license_type=$(grep -i "license:" "$license_file" 2>/dev/null | head -1 || echo "Unknown")
            local license_short=$(echo "$license_type" | sed 's/.*License: //' | head -1)
            echo "| $repo | $license_short | [View]($repo.LICENSE) |" >> "$LICENSE_DIR/ATTRIBUTION.md"
        fi
    done

    echo "" >> "$LICENSE_DIR/ATTRIBUTION.md"
    echo "## Data Usage Notice" >> "$LICENSE_DIR/ATTRIBUTION.md"
    echo "" >> "$LICENSE_DIR/ATTRIBUTION.md"
    echo "This project uses data from the following sources. Please review individual license files for terms of use." >> "$LICENSE_DIR/ATTRIBUTION.md"
    echo "BIN and card data is factual information and typically not copyrightable, but we provide attribution as best practice." >> "$LICENSE_DIR/ATTRIBUTION.md"

    log_info "Attribution summary saved to: $LICENSE_DIR/ATTRIBUTION.md"
}

# Run main function
main "$@"
