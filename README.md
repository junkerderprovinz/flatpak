# Junker der Provinz on Flatpak

Hi! This repository builds the Flatpak repository for my desktop apps. Add it once, and new versions come in through `flatpak update` or your software center like any other app.

The page with every app on it: https://junkerderprovinz.github.io/flatpak/

## Install

```sh
flatpak remote-add --user --if-not-exists junkerderprovinz https://junkerderprovinz.github.io/flatpak/junkerderprovinz.flatpakrepo
flatpak install junkerderprovinz io.github.junkerderprovinz.arrowloop
```

The apps run on the GNOME runtime from Flathub. Most systems have Flathub set up already. If yours doesn't, add it before the install:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

You can skip all of this and click Install on the page instead. Each app has a `.flatpakref` there that brings both repositories along.

| App | App ID |
|-----|--------|
| [ArrowLoop](https://github.com/junkerderprovinz/arrowloop) | `io.github.junkerderprovinz.arrowloop` |

## Going back a version

The version before the current one stays in the repository, so a release that gives you trouble is easy to step back from:

```sh
flatpak remote-info --log junkerderprovinz io.github.junkerderprovinz.arrowloop
flatpak update --commit=<commit from the log> io.github.junkerderprovinz.arrowloop
```

A plain `flatpak update` later brings you back to the newest one.

## How it is built

[`publish.yml`](.github/workflows/publish.yml) runs `build.sh` and puts the result on GitHub Pages. It runs when an app publishes a release, once a week, and on every push to `main`.

`build.sh` starts from the repository that is already published, so the history survives the rebuild. For every app in [`apps.txt`](apps.txt) it downloads the amd64 and arm64 bundles of the newest release and commits each one on top of the version before it, signed. Then it adds the update deltas, keeps the newest two versions of each app (`KEEP_VERSIONS`) and writes the `.flatpakrepo`, the `.flatpakref` files and the page. The build stops at 900 MB, a good way below what Pages will serve.

## Adding an app

Add a line to `apps.txt`, with the repository, the app ID and the name. That's all as long as each release carries `<repo>-linux-amd64.flatpak` and `<repo>-linux-arm64.flatpak`. To get updates out right away, the app's release workflow sends a dispatch at the end:

```yaml
      - name: Update the Flatpak repository
        env:
          GH_TOKEN: ${{ secrets.FLATPAK_DISPATCH_TOKEN }}
        run: gh api repos/junkerderprovinz/flatpak/dispatches -f event_type=release
```

`FLATPAK_DISPATCH_TOKEN` is a fine-grained token for this repository alone, with read and write access to its contents.

## The signing key

The private key lives in the `FLATPAK_SIGNING_KEY` secret and nowhere else. The public half is exported from it on every build, so it never has to be kept in sync by hand. To make the key, in a throwaway GnuPG home:

```sh
export GNUPGHOME=$(mktemp -d)
gpg --batch --passphrase '' --quick-gen-key 'Junker der Provinz Flatpak' ed25519 sign never
gpg --armor --export-secret-keys | gh secret set FLATPAK_SIGNING_KEY -R junkerderprovinz/flatpak
gpg --armor --export-secret-keys > ~/flatpak-signing-key.asc   # into the password manager, then delete it
gpg --fingerprint
rm -rf "$GNUPGHOME"
```

Changing the key later locks everyone out who added the old one, and the next build stops too, because it checks the published repository against the current key. So keep the backup safe.

## Testing locally

`build.sh` needs `flatpak`, `ostree`, `gpg` and `curl`. The image the workflow uses has all of them. Point `BASE_URL` at the address you serve the output from:

```sh
BASE_URL=http://localhost:8000 ./build.sh public
python3 -m http.server 8000 -d public
```
