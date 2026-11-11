#!/usr/bin/env bash
# Builds the signed OSTree repository for every app in apps.txt, with the
# .flatpakrepo, a .flatpakref per app and the index page, into one directory
# that is served as it is.
#
#   build.sh OUT
#
# Signs with the first secret key in GNUPGHOME. BASE_URL is where OUT will be
# served; the build also pulls the previous state from there.
set -euo pipefail

out=${1:?usage: build.sh OUT}
base_url=${BASE_URL:-https://junkerderprovinz.github.io/flatpak}
apps=${APPS:-apps.txt}
# Versions kept per app and architecture, so a bad release can be undone
# with `flatpak update --commit`. Pages stops at about 1 GB.
keep=${KEEP_VERSIONS:-2}
limit_mb=${LIMIT_MB:-900}
here=$(cd "$(dirname "$0")" && pwd)

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

key=$(gpg --batch --list-secret-keys --with-colons | awk -F: '$1 == "fpr" { print $10; exit }')
if [ -z "$key" ]; then
  echo "no secret key in ${GNUPGHOME:-~/.gnupg}" >&2
  exit 1
fi
gpg --batch --export "$key" > "$work/key.gpg"
gpgkey=$(base64 -w0 "$work/key.gpg")

repo=$out/repo
mkdir -p "$out"
ostree init --repo="$repo" --mode=archive

# The published repository is the only copy of the history, so every build
# starts from it. Only a site that does not exist yet starts empty; any other
# answer stops the run rather than throw the history away.
status=$(curl -s -o /dev/null -w '%{http_code}' "$base_url/repo/summary")
case $status in
  200)
    ostree --repo="$repo" remote add --gpg-import="$work/key.gpg" live "$base_url/repo/"
    ostree --repo="$repo" pull --mirror --depth=-1 live
    ostree --repo="$repo" remote delete live
    ;;
  404)
    echo "nothing published at $base_url yet, starting empty"
    ;;
  *)
    echo "$base_url/repo/summary answered $status" >&2
    exit 1
    ;;
esac

items=
while read -r repository app_id name tag <&3; do
  case $repository in '' | '#'*) continue ;; esac
  if [ -z "$tag" ]; then
    latest=$(curl -fsSIL -o /dev/null -w '%{url_effective}' "https://github.com/$repository/releases/latest")
    tag=${latest##*/}
  fi
  echo "$name $tag"

  for arch in amd64 arm64; do
    file=${repository#*/}-linux-$arch.flatpak
    curl -fsSL -o "$work/$file" "https://github.com/$repository/releases/download/$tag/$file"

    # The bundle's commit has no parent. Committing its tree again on top of
    # the published ref keeps the history, so the version before stays there
    # to roll back to. The same tree twice makes no new commit.
    staging=$work/$app_id-$arch
    ostree init --repo="$staging" --mode=archive
    flatpak build-import-bundle --no-update-summary "$staging" "$work/$file"
    ref=$(ostree refs --repo="$staging")
    flatpak build-commit-from --no-update-summary --gpg-sign="$key" \
      --subject="$name ${tag#v}" --src-repo="$staging" --src-ref="$ref" "$repo" "$ref"
  done

  # Flatpak reads RuntimeRepo from a .flatpakref only, so this is the way in
  # that also works on a system without Flathub.
  cat > "$out/$app_id.flatpakref" <<EOF
[Flatpak Ref]
Name=$app_id
Branch=${ref##*/}
Title=$name
Url=$base_url/repo/
SuggestRemoteName=junkerderprovinz
RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo
IsRuntime=false
GPGKey=$gpgkey
EOF

  items+="
      <li>
        <h3>$name</h3>
        <pre><code>flatpak install junkerderprovinz $app_id</code></pre>
        <p><a class=\"button\" href=\"$app_id.flatpakref\">Install</a> <a href=\"https://github.com/$repository\">Source and releases</a></p>
      </li>"
done 3< "$apps"

flatpak build-update-repo --gpg-sign="$key" \
  --generate-static-deltas --prune --prune-depth=$((keep - 1)) \
  --title="Junker der Provinz" --homepage="$base_url/" \
  --comment="Desktop apps by Junker der Provinz" "$repo"

cat > "$out/junkerderprovinz.flatpakrepo" <<EOF
[Flatpak Repo]
Title=Junker der Provinz
Url=$base_url/repo/
Homepage=$base_url/
Comment=Desktop apps by Junker der Provinz
GPGKey=$gpgkey
EOF

page=$(< "$here/site/index.html")
page=${page//@BASE_URL@/"$base_url"}
page=${page//@FINGERPRINT@/"$key"}
page=${page//'<!-- apps -->'/"$items"}
printf '%s\n' "$page" > "$out/index.html"

size=$(du -sm "$out" | cut -f1)
echo "$out holds $size MB"
if [ "$size" -gt "$limit_mb" ]; then
  echo "that is over the $limit_mb MB this build allows, lower KEEP_VERSIONS" >&2
  exit 1
fi
