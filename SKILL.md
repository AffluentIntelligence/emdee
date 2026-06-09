# EMDEE Conventions Skill

Operational conventions for working inside an EMDEE vault. Apply these rules in every session without needing to re-read INSTRUCTIONS docs.

---

## Media assets

EMDEE is the canonical media host. Every binary (image, future video/audio) is stored in Supabase Storage and its stable public URL is recorded in a vault node under `images/`. Consumers (whatelz.ai, content drafting, training sets) find assets by searching EMDEE and reading the URL from the node — never by guessing paths or storing copies.

### Storage

- **Bucket:** `vault-images` (public-read). Add new buckets for AV only when AV actually lands.
- **Object path convention:** `{userId}/{role}-{subject}[-{variant}]-{timestamp}.{ext}`
- **Upload endpoint:** `POST /api/media` — returns `{ public_url, storage_path }`. No vault doc is created; annotation is a separate step.
- **Public URL shape:** `{SUPABASE_URL}/storage/v1/object/public/vault-images/{userId}/{filename}` — stable, no expiry.

### Vault node shape

Every media asset gets one `.md` node under `images/`, child of `images/IMAGES.md`.

**Summary line must start:** `MEDIA · {PROJECT} · {role} · {subject}`

Example: `MEDIA · WHATELZ · cover · whatelz`

**Required section:** `## Asset` — machine-readable key-value block. Parse this section for data; never scrape prose.

```markdown
## Asset

url: https://xyz.supabase.co/storage/v1/object/public/vault-images/user_xxx/cover-whatelz-2026-06-09T12-00-00.jpg
storage_bucket: vault-images
storage_path: user_xxx/cover-whatelz-2026-06-09T12-00-00.jpg
role: cover
project: WHATELZ
subject: whatelz
variant:
format: image/jpeg
dimensions: 1200x630
alt: Cover image for whatelz.ai
used_on: [[WHATELZ]]
status: active
captured: 2026-06-09
```

All fields are optional except `url`. Omit unknown fields rather than leaving them blank.

### Role vocabulary (controlled)

| Role | Slot type | Meaning |
|---|---|---|
| `cover` | single | Primary cover / hero image for a project or page |
| `hero` | single | Full-width banner hero image |
| `og-image` | single | Open Graph / social share image |
| `logo` | single | Project or brand logo |
| `icon` | single | App icon or favicon |
| `avatar` | single | Person or account avatar |
| `thumbnail` | multi | Small preview image |
| `screenshot` | multi | UI or product screenshot |
| `diagram` | multi | Architecture or flow diagram |
| `banner` | multi | Decorative banner image |
| `gallery` | multi | Gallery item — no slot constraint |

**Single-slot invariant:** at most one `status: active` per `(project, role)` pair for single-slot roles. Before activating a new cover/hero/logo, set the previous one to `status: archived`.

### Canonical query pattern

To find an asset: `search("MEDIA {PROJECT} {role}")` — the summary prefix makes this reliable. Extract the URL from `## Asset`, never from prose.

### Lint

`lint_doc` fires `media_asset_missing_url` when a `## Asset` section exists but has no `url:` line. Fix by adding the Supabase Storage URL before publishing the node.

### Workflow: upload → annotate

1. Upload binary via `POST /api/media` (role + subject + optional variant + file) → get `{ public_url, storage_path }`
2. Create vault node: `create_child(parent_path="images/IMAGES.md", title="MEDIA · {PROJECT} · {role} · {subject}", summary="MEDIA · {PROJECT} · {role} · {subject} — {one-line description}")`
3. `patch_section` the `## Asset` block with all known fields, `url:` first
4. `add_association` to the relevant project/person/event node
5. If replacing an active single-slot asset: `patch_section` the old node's `## Asset` to set `status: archived`
